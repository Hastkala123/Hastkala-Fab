import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { NotFoundError, UserError } from "@/server/errors";
import { changeOrderStatusTx } from "@/server/orders/service";
import { flagPayment } from "@/server/payments/refunds";
import { isAwaitingPayment } from "@/server/payments/service";
import { confirmThreshold, orderPaymentStatus } from "@/server/payments/status";

/**
 * Bank transfers (NEFT / RTGS / IMPS). The buyer tells us the UTR; nothing
 * counts as paid until a staff member with "payments.verify" has seen the
 * money in the bank and confirms it.
 */

export async function submitBankTransfer(
  user: SessionUser,
  input: { orderNumber: string; amount: number; reference: string; paidOn?: string },
): Promise<void> {
  const order = await db.order.findFirst({
    where: { orderNumber: input.orderNumber, userId: user.id },
    select: { id: true, status: true, paymentMethod: true, grandTotal: true, amountPaid: true, amountRefunded: true },
  });
  if (!order) throw new NotFoundError("Order not found");
  if (order.status === "CANCELLED" || order.status === "RTO_DELIVERED") {
    throw new UserError("This order is cancelled. If you have already sent money, please contact us for a refund.", 409);
  }
  if (order.paymentMethod === "COD") throw new UserError("This is a cash-on-delivery order.", 409);
  const balance = order.grandTotal - (order.amountPaid - order.amountRefunded);
  if (balance <= 0) throw new UserError("Nothing is due on this order.", 409);
  if (input.amount > balance) {
    throw new UserError("Please correct the highlighted fields", 422, { amount: `Only ${formatPrice(balance)} is due on this order.` });
  }

  const note = `You told us about a bank transfer of ${formatPrice(input.amount)} (UTR ${input.reference}${input.paidOn ? `, sent ${input.paidOn}` : ""}). We'll confirm it once it reaches our account — usually within one working day.`;
  try {
    await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          provider: "MANUAL",
          method: "BANK_TRANSFER",
          status: "CREATED",
          amount: input.amount,
          manualReference: input.reference,
          idempotencyKey: `manual:${order.id}:${input.reference}`,
        },
      });
      await flagPayment(tx, payment.id, `Bank transfer to verify: ${formatPrice(input.amount)}, UTR ${input.reference}`);
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: order.status, toStatus: order.status, note, actorType: "CUSTOMER", actorId: user.id },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new UserError("Please correct the highlighted fields", 422, { reference: "You've already told us about this transfer." });
    }
    throw error;
  }
}

/** Staff: the money is (or isn't) in the bank. */
export async function reviewBankTransfer(
  staff: SessionUser,
  input: { paymentId: string; approve: boolean; reason: string | null },
): Promise<void> {
  const found = await db.payment.findUnique({ where: { id: input.paymentId }, select: { orderId: true } });
  if (!found) throw new NotFoundError("Payment not found");
  if (!input.approve && !input.reason) {
    throw new UserError("Please correct the highlighted fields", 422, { reason: "Tell the buyer what's wrong, e.g. no transfer with this UTR." });
  }

  await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${found.orderId} FOR UPDATE`;
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
      if (payment.provider !== "MANUAL" || payment.status !== "CREATED") {
        throw new UserError("This transfer has already been reviewed.", 409);
      }
      const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
      const now = new Date();

      if (!input.approve) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED", failureReason: input.reason, verifiedById: staff.id, attentionReason: null, attentionAt: null },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: order.status,
            note: `We couldn't match your bank transfer (UTR ${payment.manualReference}): ${input.reason}`,
            actorType: "STAFF",
            actorId: staff.id,
          },
        });
        return;
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "CAPTURED", capturedAt: now, verifiedById: staff.id, attentionReason: null, attentionAt: null },
      });
      const updated = await tx.order.update({
        where: { id: order.id },
        data: { amountPaid: { increment: payment.amount } },
        select: { grandTotal: true, amountPaid: true, amountRefunded: true },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          note: `Bank transfer of ${formatPrice(payment.amount)} received (UTR ${payment.manualReference}). Thank you!`,
          actorType: "STAFF",
          actorId: staff.id,
        },
      });

      const kept = updated.amountPaid - updated.amountRefunded;
      if (order.status === "CANCELLED") {
        await flagPayment(tx, payment.id, `Order was cancelled — return ${formatPrice(payment.amount)} to the buyer by bank transfer`);
      } else if (isAwaitingPayment(order.status) && kept >= confirmThreshold(order)) {
        await changeOrderStatusTx(tx, order.id, "CONFIRMED", { type: "STAFF", user: staff }, {
          expectedFrom: order.status,
          note: kept >= order.grandTotal ? "Payment received — order confirmed." : "Advance received — order confirmed.",
        });
        if (order.paymentMethod !== "BANK_TRANSFER" && order.paymentMethod !== "CREDIT") {
          await tx.order.update({ where: { id: order.id }, data: { paymentMethod: "BANK_TRANSFER" } });
        }
      }
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: orderPaymentStatus({ ...updated, unpaidStatus: "PENDING" }) },
      });
    },
    { timeout: 20_000, maxWait: 10_000 },
  );

  await audit({
    actor: staff,
    action: input.approve ? "payment.transfer.verify" : "payment.transfer.reject",
    entityType: "Payment",
    entityId: input.paymentId,
    after: { reason: input.reason },
  });
}
