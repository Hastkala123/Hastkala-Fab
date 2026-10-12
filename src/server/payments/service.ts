import "server-only";

import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/utils";
import { NotFoundError, UserError } from "@/server/errors";
import { kickJobs } from "@/server/jobs/kick";
import { changeOrderStatusTx, readAddress } from "@/server/orders/service";
import { getSettings } from "@/server/settings";
import { activeGateway, gatewayFor } from "./gateway";
import { createRefundTx, flagPayment } from "./refunds";
import { ATTEMPT_RANK, confirmThreshold, isCaptured, orderPaymentStatus } from "./status";
import { GatewayError, mapGatewayMethod, type GatewayName, type GatewayPayment } from "./types";

/**
 * Online payments for an order.
 *
 * The order is marked paid only from the gateway's own record of the payment:
 * a signed webhook, or the gateway's API asked directly by our server. What
 * the browser says is never trusted — its signature only proves which payment
 * to look up. Every path ends in recordGatewayPayment(), which is idempotent,
 * so the webhook, the browser's confirmation and reconciliation can all
 * report the same payment without double counting.
 */

const SYSTEM = { type: "SYSTEM" as const, user: null };
/** Less time than this left in the payment window: don't open the payment page. */
export const MIN_SECONDS_TO_PAY = 30;
/** Payment window for paying a balance (no stock is being held). */
const BALANCE_WINDOW_SECONDS = 15 * 60;
/** Orders whose balance can no longer be paid online. */
const CLOSED_STATUSES: OrderStatus[] = ["CANCELLED", "RTO_IN_TRANSIT", "RTO_DELIVERED"];

export const isAwaitingPayment = (status: OrderStatus) => status === "PENDING_PAYMENT" || status === "PAYMENT_FAILED";

export type CheckoutSession = {
  gateway: "razorpay" | "test";
  keyId: string;
  providerOrderId: string;
  amount: number;
  orderNumber: string;
  storeName: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  /** The payment window closes after this many seconds. */
  secondsLeft: number;
};

/**
 * "Pay now": opens (or reopens) payment for an order awaiting it — the whole
 * amount, or the advance on "advance + balance" terms — or for the balance of
 * a confirmed wholesale order.
 */
export async function startPayment(user: SessionUser, orderNumber: string): Promise<CheckoutSession> {
  const settings = await getSettings();
  const gateway = activeGateway();
  if (!gateway || !settings.checkout.onlinePaymentsEnabled) {
    throw new UserError("Online payment isn't available right now. Please try again later or contact us.", 503);
  }

  const order = await db.order.findFirst({
    where: { orderNumber, userId: user.id },
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      paymentDueBy: true,
      grandTotal: true,
      amountPaid: true,
      amountRefunded: true,
      contactEmail: true,
      contactPhone: true,
      shippingAddress: true,
      advanceAmount: true,
    },
  });
  if (!order) throw new NotFoundError("Order not found");
  if (order.paymentMethod === "COD") throw new UserError("This is a cash-on-delivery order, so there's nothing to pay now.", 409);
  const kept = order.amountPaid - order.amountRefunded;
  const awaiting = isAwaitingPayment(order.status);
  if (!awaiting && (CLOSED_STATUSES.includes(order.status) || kept >= order.grandTotal)) {
    throw new UserError(
      kept >= order.grandTotal ? "This order is already paid." : "This order can no longer be paid. Refresh to see its status.",
      409,
    );
  }
  let secondsLeft = BALANCE_WINDOW_SECONDS;
  if (awaiting) {
    secondsLeft = order.paymentDueBy ? Math.floor((order.paymentDueBy.getTime() - Date.now()) / 1000) : 0;
    if (secondsLeft < MIN_SECONDS_TO_PAY) {
      throw new UserError("The time to pay for this order has run out, so the items are being released. Please place the order again.", 409);
    }
  }
  // Awaiting: enough to confirm (the advance, or everything). Confirmed: the balance.
  const amount = (awaiting ? confirmThreshold(order) : order.grandTotal) - kept;
  if (amount <= 0) throw new UserError("This order is already paid.", 409);

  let payment;
  try {
    payment = await db.$transaction(
      async (tx) => {
        // One opener at a time per order, so two tabs can't create two gateway orders.
        await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
        const current = await tx.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
        if (awaiting ? !isAwaitingPayment(current.status) : CLOSED_STATUSES.includes(current.status)) {
          throw new UserError("This order can no longer be paid. Refresh to see its status.", 409);
        }
        if (current.status === "PAYMENT_FAILED") {
          await changeOrderStatusTx(tx, order.id, "PENDING_PAYMENT", { type: "CUSTOMER", user }, {
            expectedFrom: "PAYMENT_FAILED",
            note: "Payment tried again",
          });
        }
        // Retries reuse the same gateway order, so the gateway itself refuses
        // a second successful payment for it.
        const reusable = await tx.payment.findFirst({
          where: { orderId: order.id, provider: gateway.name, amount, providerOrderId: { not: null } },
          orderBy: { createdAt: "desc" },
        });
        if (reusable) return reusable;
        const gatewayOrder = await gateway.createOrder({
          amount,
          receipt: orderNumber,
          notes: { orderNumber, orderId: order.id },
        });
        return tx.payment.create({
          data: {
            orderId: order.id,
            provider: gateway.name,
            status: "CREATED",
            amount,
            providerOrderId: gatewayOrder.id,
            idempotencyKey: `gateway-order:${gatewayOrder.id}`,
          },
        });
      },
      { timeout: 25_000, maxWait: 10_000 },
    );
  } catch (error) {
    if (error instanceof GatewayError) {
      console.error("[payments] could not create gateway order:", error.message);
      throw new UserError("We couldn't reach the payment service. Please try again in a minute.", 502);
    }
    throw error;
  }

  const address = readAddress(order.shippingAddress);
  return {
    gateway: gateway.name === "RAZORPAY" ? "razorpay" : "test",
    keyId: gateway.keyId,
    providerOrderId: payment.providerOrderId!,
    amount,
    orderNumber,
    storeName: settings["store.profile"].displayName,
    description: awaiting && amount < order.grandTotal - kept ? `Advance for order ${orderNumber}` : awaiting ? `Order ${orderNumber}` : `Balance for order ${orderNumber}`,
    prefill: {
      name: address?.fullName ?? user.name,
      email: order.contactEmail ?? user.email ?? "",
      contact: order.contactPhone.replace(/[^\d+]/g, ""),
    },
    secondsLeft,
  };
}

/** After the browser's payment window reports success: verify and look the payment up. */
export async function confirmCheckoutPayment(
  user: SessionUser,
  input: { orderNumber: string; providerOrderId: string; providerPaymentId: string; signature: string },
): Promise<{ status: OrderStatus; paid: boolean }> {
  const order = await db.order.findFirst({
    where: { orderNumber: input.orderNumber, userId: user.id },
    select: { id: true },
  });
  if (!order) throw new NotFoundError("Order not found");
  const attempt = await db.payment.findFirst({
    where: { orderId: order.id, providerOrderId: input.providerOrderId },
    select: { provider: true },
  });
  const gateway = attempt ? gatewayFor(attempt.provider) : null;
  if (!attempt || !gateway) throw new UserError("We couldn't match this payment to your order.", 400);
  if (!gateway.verifyCheckoutSignature(input.providerOrderId, input.providerPaymentId, input.signature)) {
    throw new UserError(
      "We couldn't verify this payment. If money left your account, it will be confirmed or refunded automatically.",
      400,
    );
  }

  // The signature proves the id is genuine; the gateway's record says what happened.
  try {
    const payment = await gateway.fetchPayment(input.providerPaymentId);
    if (payment && payment.orderId === input.providerOrderId) {
      await applyGatewayPayment(gateway.name, payment);
    }
  } catch (error) {
    // The webhook or the next reconciliation will catch up.
    console.warn("[payments] could not look up payment after checkout:", (error as Error).message);
  }
  const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true, paymentStatus: true } });
  return { status: fresh.status, paid: fresh.paymentStatus === "PAID" };
}

/** "Check again" from the order page, or after the shopper closes the payment window. */
export async function refreshOrderPayment(user: SessionUser, orderNumber: string) {
  const order = await db.order.findFirst({
    where: { orderNumber, userId: user.id },
    select: { id: true, status: true },
  });
  if (!order) throw new NotFoundError("Order not found");
  if (isAwaitingPayment(order.status)) {
    await syncOrderPayments(order.id).catch((error) =>
      console.warn("[payments] status check failed:", (error as Error).message),
    );
  }
  const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true, paymentStatus: true } });
  return { status: fresh.status, paid: fresh.paymentStatus === "PAID" };
}

// ---------------------------------------------------------------------------
// Recording what the gateway reports
// ---------------------------------------------------------------------------

type RecordResult = { orderId: string | null; captureAmount: number | null; refundQueued: boolean };

/**
 * Applies one gateway payment to our books, then captures it if the gateway
 * is holding it for us and the order still wants it.
 */
export async function applyGatewayPayment(provider: GatewayName, payment: GatewayPayment): Promise<void> {
  const result = await recordGatewayPayment(provider, payment);
  if (result.refundQueued) kickJobs();
  if (result.captureAmount === null) return;

  const gateway = gatewayFor(provider);
  if (!gateway) return;
  let captured: GatewayPayment | null = null;
  try {
    captured = await gateway.capture(payment.id, result.captureAmount);
  } catch (error) {
    // Already captured by the gateway's auto-capture, or a hiccup: ask again.
    captured = await gateway.fetchPayment(payment.id).catch(() => null);
    if (!captured || captured.status !== "captured") {
      console.warn("[payments] capture failed; reconciliation will retry:", (error as Error).message);
      return;
    }
  }
  const second = await recordGatewayPayment(provider, captured);
  if (second.refundQueued) kickJobs();
}

function failureNote(payment: GatewayPayment): string {
  const reason = payment.errorDescription?.replace(/\.$/, "");
  return reason ? `The payment didn't go through: ${reason}.` : "The payment didn't go through.";
}

export async function recordGatewayPayment(provider: GatewayName, payment: GatewayPayment): Promise<RecordResult> {
  const none: RecordResult = { orderId: null, captureAmount: null, refundQueued: false };
  if (!payment.orderId) return none; // not created through our checkout

  return db.$transaction(
    async (tx) => {
      const anchor = await tx.payment.findFirst({
        where: { provider, providerOrderId: payment.orderId },
        select: { orderId: true },
      });
      if (!anchor) return none;

      // Lock order: Order → Payment → Refund, the same everywhere.
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${anchor.orderId} FOR UPDATE`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: anchor.orderId } });
      const result: RecordResult = { orderId: order.id, captureAmount: null, refundQueued: false };

      // This attempt's row: known already, the placeholder made when the
      // payment page opened, or a new row for a further attempt.
      let row = await tx.payment.findUnique({ where: { providerPaymentId: payment.id } });
      if (row && row.orderId !== order.id) throw new Error(`Payment ${payment.id} is recorded against another order`);
      if (!row) {
        const placeholder = await tx.payment.findFirst({
          where: { orderId: order.id, provider, providerOrderId: payment.orderId, providerPaymentId: null },
          orderBy: { createdAt: "asc" },
        });
        row = placeholder
          ? await tx.payment.update({ where: { id: placeholder.id }, data: { providerPaymentId: payment.id } })
          : await tx.payment.create({
              data: {
                orderId: order.id,
                provider,
                status: "CREATED",
                amount: payment.amount,
                providerOrderId: payment.orderId,
                providerPaymentId: payment.id,
                idempotencyKey: `gateway-payment:${payment.id}`,
              },
            });
      }

      const now = new Date();
      const method = mapGatewayMethod(payment.method);
      // "refunded" at the gateway means it was captured first; refunds are matched separately.
      const reported = payment.status === "refunded" ? "captured" : payment.status;

      if (reported === "created") return result;

      if (reported === "failed") {
        if (ATTEMPT_RANK[row.status] > ATTEMPT_RANK.FAILED) return result;
        await tx.payment.update({
          where: { id: row.id },
          data: {
            status: "FAILED",
            method: method ?? row.method,
            failureCode: payment.errorCode?.slice(0, 100) ?? null,
            failureReason: payment.errorDescription?.slice(0, 500) ?? "Payment failed",
            lastSyncedAt: now,
          },
        });
        const stillGoing = await tx.payment.count({
          where: { orderId: order.id, status: { in: ["AUTHORIZED", "CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"] } },
        });
        if (order.status === "PENDING_PAYMENT" && stillGoing === 0) {
          await changeOrderStatusTx(tx, order.id, "PAYMENT_FAILED", SYSTEM, {
            expectedFrom: "PENDING_PAYMENT",
            note: failureNote(payment),
          });
          if (order.amountPaid === 0) await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED" } });
        }
        return result;
      }

      if (reported === "authorized") {
        if (ATTEMPT_RANK[row.status] < ATTEMPT_RANK.AUTHORIZED) {
          await tx.payment.update({
            where: { id: row.id },
            data: { status: "AUTHORIZED", method: method ?? row.method, lastSyncedAt: now },
          });
        }
        // Take the money only while the order still wants it. Otherwise the
        // gateway hands an uncaptured payment back to the shopper by itself.
        if (!isCaptured(row.status) && isAwaitingPayment(order.status) && payment.currency === "INR") {
          result.captureAmount = payment.amount;
        }
        return result;
      }

      // Captured.
      if (isCaptured(row.status)) return result; // already booked
      await tx.payment.update({
        where: { id: row.id },
        data: {
          status: "CAPTURED",
          amount: payment.amount,
          method: method ?? row.method,
          capturedAt: now,
          failureCode: null,
          failureReason: null,
          lastSyncedAt: now,
        },
      });

      if (payment.currency !== "INR") {
        await flagPayment(tx, row.id, `Paid in ${payment.currency}, not INR — check before shipping`);
        return result;
      }
      if (payment.amount !== row.amount) {
        await flagPayment(tx, row.id, `Gateway amount ${formatPrice(payment.amount)} differs from the ${formatPrice(row.amount)} asked for`);
      }

      const keptBefore = order.amountPaid - order.amountRefunded;
      const stillDue = Math.max(order.grandTotal - keptBefore, 0);
      await tx.order.update({
        where: { id: order.id },
        data: { amountPaid: { increment: payment.amount }, ...(method && isAwaitingPayment(order.status) ? { paymentMethod: method } : {}) },
      });

      const methodLabel = method ? ` by ${PAYMENT_METHOD_LABELS[method] ?? method}` : "";
      if (order.status === "CANCELLED") {
        // Paid after the order was cancelled (often: the payment window had closed).
        await createRefundTx(tx, {
          orderId: order.id,
          paymentId: row.id,
          amount: payment.amount,
          reason: "Payment arrived after the order was cancelled",
        });
        result.refundQueued = true;
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: order.status,
            note: `We received ${formatPrice(payment.amount)}${methodLabel} after this order was cancelled, so it is being refunded in full. It usually shows in your account within 5–7 working days.`,
            actorType: "SYSTEM",
          },
        });
      } else {
        const excess = payment.amount - stillDue;
        if (excess > 0) {
          // A second payment for an order that was already paid.
          await createRefundTx(tx, {
            orderId: order.id,
            paymentId: row.id,
            amount: excess,
            reason: stillDue === 0 ? "Duplicate payment for an order already paid" : "Paid more than the order total",
          });
          result.refundQueued = true;
          await flagPayment(tx, row.id, `Extra payment of ${formatPrice(excess)} received — refund started automatically`);
        }
        if (isAwaitingPayment(order.status)) {
          const keptAfter = keptBefore + Math.min(payment.amount, stillDue);
          const needed = confirmThreshold(order);
          if (keptAfter >= needed) {
            await changeOrderStatusTx(tx, order.id, "CONFIRMED", SYSTEM, {
              expectedFrom: order.status,
              note:
                keptAfter >= order.grandTotal
                  ? `Payment of ${formatPrice(Math.min(payment.amount, stillDue))} received${methodLabel}.`
                  : `Advance of ${formatPrice(payment.amount)} received${methodLabel}. The balance of ${formatPrice(order.grandTotal - keptAfter)} is due before dispatch.`,
            });
          } else {
            await flagPayment(tx, row.id, `Paid ${formatPrice(payment.amount)}, less than the ${formatPrice(needed - keptBefore)} needed to confirm`);
          }
        } else if (payment.amount > 0) {
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: order.status,
              note: `Payment of ${formatPrice(Math.min(payment.amount, stillDue))} received${methodLabel}.`,
              actorType: "SYSTEM",
            },
          });
        }
      }

      const totals = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { grandTotal: true, amountPaid: true, amountRefunded: true },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: orderPaymentStatus({ ...totals, unpaidStatus: "PENDING" }) },
      });
      return result;
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}

// ---------------------------------------------------------------------------
// Asking the gateway (missed webhooks, expiry, reconciliation)
// ---------------------------------------------------------------------------

/** Pulls every attempt on one gateway order and applies them. */
export async function syncGatewayOrder(provider: GatewayName, providerOrderId: string): Promise<void> {
  const gateway = gatewayFor(provider);
  if (!gateway) return;
  const payments = await gateway.fetchOrderPayments(providerOrderId);
  // Failures first, so a later success is the last word.
  payments.sort((a, b) => rankOf(a) - rankOf(b));
  for (const payment of payments) await applyGatewayPayment(provider, payment);
  await db.payment.updateMany({ where: { provider, providerOrderId }, data: { lastSyncedAt: new Date() } });
}

const rankOf = (p: GatewayPayment) =>
  ({ created: 0, failed: 1, authorized: 2, captured: 3, refunded: 4 })[p.status];

/** Asks the gateway about every gateway order opened for this order. Throws if the gateway can't be reached. */
export async function syncOrderPayments(orderId: string): Promise<void> {
  const attempts = await db.payment.findMany({
    where: { orderId, provider: { in: ["RAZORPAY", "TEST"] }, providerOrderId: { not: null } },
    select: { provider: true, providerOrderId: true },
    distinct: ["providerOrderId"],
  });
  for (const attempt of attempts) {
    await syncGatewayOrder(attempt.provider as GatewayName, attempt.providerOrderId!);
  }
}
