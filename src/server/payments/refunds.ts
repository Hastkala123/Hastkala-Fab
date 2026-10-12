import "server-only";

import type { Prisma, RefundStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { UserError } from "@/server/errors";
import { enqueueJob } from "@/server/jobs/enqueue";
import { formatRefundNumber } from "@/server/numbering/format";
import { nextSequence } from "@/server/numbering/sequence";
import { gatewayFor } from "./gateway";
import { attemptStatusAfterRefunds, isCaptured, orderPaymentStatus } from "./status";
import { GatewayError, type GatewayRefund } from "./types";

/**
 * Refunds to the original payment method.
 *
 * Money is reserved when the refund is created (inside the transaction that
 * decided to refund), so two refunds can never add up to more than was paid.
 * The gateway call happens afterwards from the job queue, and is safe to
 * repeat: before asking for a refund we look for one already carrying our
 * refund number. A refund that finally fails gives its reservation back and
 * flags the payment for staff.
 *
 * Lock order everywhere: Order → Payment → Refund (no deadlocks).
 */

type Tx = Prisma.TransactionClient;

const CUSTOMER_REFUND_NOTE = "It usually shows in your account within 5–7 working days.";

async function lockOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
}

/** Positive delta reserves refunded money on the attempt and the order; negative gives it back. */
async function adjustRefunded(tx: Tx, paymentId: string, orderId: string, delta: number): Promise<void> {
  const payment = await tx.payment.update({
    where: { id: paymentId },
    data: { amountRefunded: { increment: delta } },
    select: { amount: true, amountRefunded: true },
  });
  await tx.payment.update({
    where: { id: paymentId },
    data: { status: attemptStatusAfterRefunds(payment.amount, payment.amountRefunded) },
  });
  const order = await tx.order.update({
    where: { id: orderId },
    data: { amountRefunded: { increment: delta } },
    select: { grandTotal: true, amountPaid: true, amountRefunded: true },
  });
  await tx.order.update({
    where: { id: orderId },
    data: { paymentStatus: orderPaymentStatus({ ...order, unpaidStatus: "PENDING" }) },
  });
}

/** Marks an attempt for a person to look at (Admin → Payments). */
export async function flagPayment(tx: Tx, paymentId: string, reason: string): Promise<void> {
  const current = await tx.payment.findUnique({ where: { id: paymentId }, select: { attentionReason: true } });
  const combined =
    current?.attentionReason && !current.attentionReason.includes(reason)
      ? `${current.attentionReason} · ${reason}`
      : reason;
  await tx.payment.update({
    where: { id: paymentId },
    data: { attentionReason: combined.slice(0, 1000), attentionAt: new Date() },
  });
}

async function timelineNote(tx: Tx, orderId: string, note: string, customerVisible: boolean): Promise<void> {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order) return;
  await tx.orderStatusHistory.create({
    data: {
      orderId,
      fromStatus: order.status,
      toStatus: order.status,
      note,
      isCustomerVisible: customerVisible,
      actorType: "SYSTEM",
    },
  });
}

type CreateRefundInput = {
  orderId: string;
  paymentId: string;
  amount: number;
  reason: string;
  initiatedById?: string | null;
  /** Set when the refund already exists at the gateway (made in its dashboard). */
  gatewayRefund?: { id: string; status: RefundStatus };
};

/**
 * Creates a refund and reserves its amount. The caller must hold the order's
 * row lock (or be the order's status change, which holds it). Queues the
 * gateway call unless the refund already exists there.
 */
export async function createRefundTx(tx: Tx, input: CreateRefundInput) {
  await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${input.paymentId} FOR UPDATE`;
  const payment = await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
  if (payment.orderId !== input.orderId) throw new Error("Payment does not belong to this order");
  if (!isCaptured(payment.status)) throw new UserError("Only a completed payment can be refunded.", 409);
  const refundable = payment.amount - payment.amountRefunded;
  if (input.amount <= 0 || input.amount > refundable) {
    throw new UserError(`At most ${formatPrice(Math.max(refundable, 0))} of this payment can still be refunded.`, 409);
  }

  const refundNumber = formatRefundNumber(await nextSequence(tx, "refund"));
  const completed = input.gatewayRefund?.status === "COMPLETED";
  const refund = await tx.refund.create({
    data: {
      refundNumber,
      orderId: input.orderId,
      paymentId: payment.id,
      amount: input.amount,
      method: "ORIGINAL_SOURCE",
      status: input.gatewayRefund?.status ?? "INITIATED",
      reason: input.reason,
      providerRefundId: input.gatewayRefund?.id ?? null,
      idempotencyKey: input.gatewayRefund ? `gateway:${input.gatewayRefund.id}` : `refund:${refundNumber}`,
      initiatedById: input.initiatedById ?? null,
      processedAt: completed ? new Date() : null,
    },
  });
  await adjustRefunded(tx, payment.id, input.orderId, input.amount);
  if (!input.gatewayRefund) await enqueueJob(tx, "refund.submit", { refundId: refund.id });
  return refund;
}

/**
 * Refunds everything still held for an order (cancellation, late payment).
 * Gateway payments are refunded automatically; anything else (a bank
 * transfer) is flagged for staff to return by hand.
 */
export async function refundOrderBalanceTx(
  tx: Tx,
  orderId: string,
  reason: string,
  initiatedById: string | null,
): Promise<{ automatic: number; manual: number }> {
  const payments = await tx.payment.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
  let automatic = 0;
  let manual = 0;
  for (const payment of payments) {
    const balance = payment.amount - payment.amountRefunded;
    if (!isCaptured(payment.status) || balance <= 0) continue;
    if ((payment.provider === "RAZORPAY" || payment.provider === "TEST") && payment.providerPaymentId) {
      await createRefundTx(tx, { orderId, paymentId: payment.id, amount: balance, reason, initiatedById });
      automatic += balance;
    } else {
      await flagPayment(tx, payment.id, `Refund ${formatPrice(balance)} by hand (${reason})`);
      manual += balance;
    }
  }
  return { automatic, manual };
}

/** Gives up on a refund: releases its reservation and asks staff to step in. */
export async function failRefund(refundId: string, reason: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const found = await tx.refund.findUnique({ where: { id: refundId }, select: { orderId: true } });
    if (!found) return;
    await lockOrder(tx, found.orderId);
    await tx.$queryRaw`SELECT "id" FROM "Refund" WHERE "id" = ${refundId} FOR UPDATE`;
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId } });
    if (refund.status === "FAILED" || refund.status === "COMPLETED") return;
    await tx.refund.update({ where: { id: refundId }, data: { status: "FAILED", failureReason: reason.slice(0, 500) } });
    if (refund.paymentId) {
      await adjustRefunded(tx, refund.paymentId, refund.orderId, -refund.amount);
      await flagPayment(tx, refund.paymentId, `Refund ${refund.refundNumber} failed: ${reason}`);
    }
    await timelineNote(tx, refund.orderId, `Refund ${refund.refundNumber} of ${formatPrice(refund.amount)} failed: ${reason}`, false);
  });
}

const STATUS_FROM_GATEWAY: Record<GatewayRefund["status"], RefundStatus> = {
  pending: "PROCESSING",
  processed: "COMPLETED",
  failed: "FAILED",
};

/**
 * Records what the gateway says about a refund (from the submit call, a
 * webhook or reconciliation). Idempotent; a refund made directly in the
 * gateway's dashboard is added to the books.
 */
export async function applyGatewayRefund(provider: "RAZORPAY" | "TEST", entity: GatewayRefund): Promise<void> {
  const next = STATUS_FROM_GATEWAY[entity.status];
  const located = await db.refund.findFirst({
    where: {
      OR: [
        { providerRefundId: entity.id },
        ...(entity.receipt ? [{ refundNumber: entity.receipt, payment: { providerPaymentId: entity.paymentId } }] : []),
      ],
    },
    select: { id: true, orderId: true },
  });

  if (!located) {
    if (entity.status === "failed") return; // never moved money
    const payment = await db.payment.findUnique({
      where: { providerPaymentId: entity.paymentId },
      select: { id: true, orderId: true, provider: true },
    });
    if (!payment || payment.provider !== provider) return;
    await db.$transaction(async (tx) => {
      await lockOrder(tx, payment.orderId);
      if (await tx.refund.findUnique({ where: { providerRefundId: entity.id }, select: { id: true } })) return;
      const fresh = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
      if (entity.amount > fresh.amount - fresh.amountRefunded) {
        await flagPayment(tx, payment.id, `The gateway shows refund ${entity.id} of ${formatPrice(entity.amount)}, more than our records allow`);
        return;
      }
      const refund = await createRefundTx(tx, {
        orderId: payment.orderId,
        paymentId: payment.id,
        amount: entity.amount,
        reason: "Refunded from the payment gateway dashboard",
        gatewayRefund: { id: entity.id, status: next },
      });
      await timelineNote(tx, payment.orderId, `Refund ${refund.refundNumber} of ${formatPrice(entity.amount)} started. ${CUSTOMER_REFUND_NOTE}`, true);
    });
    return;
  }

  await db.$transaction(async (tx) => {
    await lockOrder(tx, located.orderId);
    await tx.$queryRaw`SELECT "id" FROM "Refund" WHERE "id" = ${located.id} FOR UPDATE`;
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: located.id } });
    const data: Prisma.RefundUpdateInput = {};
    if (next !== "FAILED" && refund.providerRefundId !== entity.id) data.providerRefundId = entity.id;
    // A failure only counts for the gateway refund we are waiting on — not an
    // older attempt that staff have since retried.
    const failureApplies =
      (refund.status === "PROCESSING" && refund.providerRefundId === entity.id) ||
      (refund.status === "INITIATED" && refund.providerRefundId === null);

    if (refund.status === "COMPLETED") {
      // Final. Nothing the gateway says later changes a processed refund.
    } else if (next === "COMPLETED") {
      data.status = "COMPLETED";
      data.processedAt = new Date();
      data.failureReason = null;
      if (refund.status === "FAILED" && refund.paymentId) {
        // We had given up, but the gateway did send the money: book it again.
        await adjustRefunded(tx, refund.paymentId, refund.orderId, refund.amount);
        await flagPayment(tx, refund.paymentId, `Refund ${refund.refundNumber} was marked failed but the gateway processed it`);
      }
      await timelineNote(
        tx,
        refund.orderId,
        `Refund ${refund.refundNumber} of ${formatPrice(refund.amount)} processed to your original payment method. ${CUSTOMER_REFUND_NOTE}`,
        true,
      );
    } else if (next === "FAILED") {
      if (failureApplies) {
        data.status = "FAILED";
        data.providerRefundId = entity.id;
        data.failureReason = "The payment gateway could not process this refund";
        if (refund.paymentId) {
          await adjustRefunded(tx, refund.paymentId, refund.orderId, -refund.amount);
          await flagPayment(tx, refund.paymentId, `Refund ${refund.refundNumber} failed at the gateway`);
        }
        await timelineNote(tx, refund.orderId, `Refund ${refund.refundNumber} failed at the gateway — please retry or refund by hand.`, false);
      }
    } else if (refund.status === "INITIATED") {
      data.status = "PROCESSING";
    }

    if (Object.keys(data).length > 0) await tx.refund.update({ where: { id: refund.id }, data });
  });
}

/** Job handler: send one initiated refund to its gateway. Safe to run twice. */
export async function submitRefund(refundId: string): Promise<void> {
  const refund = await db.refund.findUnique({
    where: { id: refundId },
    include: { payment: true, order: { select: { orderNumber: true } } },
  });
  if (!refund || refund.status !== "INITIATED") return;

  const payment = refund.payment;
  if (!payment?.providerPaymentId || (payment.provider !== "RAZORPAY" && payment.provider !== "TEST")) {
    await failRefund(refund.id, "There is no gateway payment to refund; please refund by hand.");
    return;
  }
  const gateway = gatewayFor(payment.provider);
  if (!gateway) {
    await failRefund(refund.id, "The payment gateway that took this payment is not configured.");
    return;
  }

  try {
    // An earlier try may have reached the gateway before we could record it.
    const earlier = (await gateway.fetchRefunds(payment.providerPaymentId)).find(
      (r) => r.receipt === refund.refundNumber && r.status !== "failed",
    );
    const result =
      earlier ??
      (await gateway.refund(payment.providerPaymentId, refund.amount, {
        receipt: refund.refundNumber,
        notes: { orderNumber: refund.order.orderNumber, refundNumber: refund.refundNumber },
      }));
    await applyGatewayRefund(payment.provider, result);
  } catch (error) {
    if (error instanceof GatewayError && !error.retryable) {
      await failRefund(refund.id, error.message);
      return;
    }
    throw error; // the job runner retries with back-off
  }
}

/** Staff "Retry refund" on a failed one: reserve again and resend. */
export async function retryRefund(refundId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const found = await tx.refund.findUnique({ where: { id: refundId }, select: { orderId: true } });
    if (!found) throw new UserError("Refund not found", 404);
    await lockOrder(tx, found.orderId);
    await tx.$queryRaw`SELECT "id" FROM "Refund" WHERE "id" = ${refundId} FOR UPDATE`;
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: true } });
    if (refund.status !== "FAILED") throw new UserError("Only a failed refund can be retried.", 409);
    if (!refund.payment) throw new UserError("This refund has no payment to go back to.", 409);
    if (refund.amount > refund.payment.amount - refund.payment.amountRefunded) {
      throw new UserError("The rest of this payment has already been refunded.", 409);
    }
    // providerRefundId keeps the failed attempt's id, so its late webhooks are recognised as stale.
    await tx.refund.update({ where: { id: refundId }, data: { status: "INITIATED", failureReason: null } });
    await adjustRefunded(tx, refund.payment.id, refund.orderId, refund.amount);
    await enqueueJob(tx, "refund.submit", { refundId });
  });
}
