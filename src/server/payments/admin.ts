import "server-only";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { NotFoundError } from "@/server/errors";
import { kickJobs } from "@/server/jobs/kick";
import { retryRefund } from "./refunds";
import { syncOrderPayments } from "./service";

/** Staff actions in Admin → Payments and on the order page. */

export async function staffSyncOrder(staff: SessionUser, orderId: string): Promise<void> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) throw new NotFoundError("Order not found");
  await syncOrderPayments(order.id);
  await audit({ actor: staff, action: "payment.sync", entityType: "Order", entityId: orderId });
}

export async function resolveAttention(staff: SessionUser, paymentId: string, note: string | null): Promise<void> {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, select: { attentionReason: true, orderId: true } });
  if (!payment) throw new NotFoundError("Payment not found");
  await db.payment.update({
    where: { id: paymentId },
    data: {
      attentionReason: null,
      attentionAt: null,
      // Reconciliation re-checks captured payments for 3 days; don't raise the
      // same flag again right after a person has looked at it.
      lastSyncedAt: new Date(Date.now() + 3 * 24 * 60 * 60_000),
    },
  });
  await audit({
    actor: staff,
    action: "payment.resolve",
    entityType: "Payment",
    entityId: paymentId,
    before: { attentionReason: payment.attentionReason },
    after: { note },
  });
}

export async function staffRetryRefund(staff: SessionUser, refundId: string): Promise<void> {
  await retryRefund(refundId);
  kickJobs();
  await audit({ actor: staff, action: "refund.retry", entityType: "Refund", entityId: refundId });
}
