import "server-only";

import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { gatewayFor } from "./gateway";
import { applyGatewayRefund, flagPayment } from "./refunds";
import { syncGatewayOrder } from "./service";
import type { GatewayName } from "./types";

/**
 * Comparing our books with the gateway's, so a lost webhook never leaves a
 * paid order unconfirmed or a payment unrefunded.
 */

const MINUTE = 60_000;

/**
 * Every minute: attempts still open on orders awaiting payment. Catches a
 * missed webhook long before the payment window ends.
 */
export async function syncOpenAttempts(now = new Date(), limit = 20): Promise<number> {
  const attempts = await db.payment.findMany({
    where: {
      provider: { in: ["RAZORPAY", "TEST"] },
      providerOrderId: { not: null },
      status: { in: ["CREATED", "FAILED", "AUTHORIZED"] },
      order: { status: { in: ["PENDING_PAYMENT", "PAYMENT_FAILED"] } },
      createdAt: { lte: new Date(now.getTime() - MINUTE) },
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lte: new Date(now.getTime() - 2 * MINUTE) } }],
    },
    select: { provider: true, providerOrderId: true },
    distinct: ["providerOrderId"],
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let synced = 0;
  for (const attempt of attempts) {
    try {
      await syncGatewayOrder(attempt.provider as GatewayName, attempt.providerOrderId!);
      synced++;
    } catch (error) {
      console.warn(`[reconcile] ${attempt.providerOrderId}:`, (error as Error).message);
    }
  }
  return synced;
}

/**
 * Hourly job: the last three days.
 *  1. Gateway orders of cancelled orders — a payment that arrived late and
 *     whose webhook was lost is found and refunded.
 *  2. Captured payments — amount and status must match the gateway; refunds
 *     made in the gateway dashboard are added to our books.
 *  3. Refunds still in progress — picked up when the gateway finishes them.
 */
export async function reconcileRecentPayments(now = new Date()): Promise<{ checked: number; flagged: number }> {
  const since = new Date(now.getTime() - 3 * 24 * 60 * MINUTE);
  const staleBefore = new Date(now.getTime() - 50 * MINUTE);
  let checked = 0;
  let flagged = 0;

  const lateCandidates = await db.payment.findMany({
    where: {
      provider: { in: ["RAZORPAY", "TEST"] },
      providerOrderId: { not: null },
      status: { in: ["CREATED", "FAILED", "AUTHORIZED"] },
      order: { status: "CANCELLED", cancelledAt: { gte: since } },
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lte: staleBefore } }],
    },
    select: { provider: true, providerOrderId: true },
    distinct: ["providerOrderId"],
    take: 100,
  });
  for (const attempt of lateCandidates) {
    try {
      await syncGatewayOrder(attempt.provider as GatewayName, attempt.providerOrderId!);
      checked++;
    } catch (error) {
      console.warn(`[reconcile] ${attempt.providerOrderId}:`, (error as Error).message);
    }
  }

  const captured = await db.payment.findMany({
    where: {
      provider: "RAZORPAY",
      providerPaymentId: { not: null },
      status: { in: ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"] },
      capturedAt: { gte: since },
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lte: staleBefore } }],
    },
    take: 100,
  });
  const gateway = gatewayFor("RAZORPAY");
  if (gateway) {
    for (const payment of captured) {
      try {
        const remote = await gateway.fetchPayment(payment.providerPaymentId!);
        checked++;
        if (!remote) {
          await db.$transaction((tx) => flagPayment(tx, payment.id, "The gateway has no record of this payment"));
          flagged++;
        } else {
          if (remote.status !== "captured" && remote.status !== "refunded") {
            await db.$transaction((tx) => flagPayment(tx, payment.id, `The gateway shows this payment as ${remote.status}`));
            flagged++;
          } else if (remote.amount !== payment.amount) {
            await db.$transaction((tx) =>
              flagPayment(tx, payment.id, `The gateway shows ${formatPrice(remote.amount)}; we recorded ${formatPrice(payment.amount)}`),
            );
            flagged++;
          }
          if (remote.amountRefunded !== payment.amountRefunded) {
            for (const refund of await gateway.fetchRefunds(remote.id)) await applyGatewayRefund("RAZORPAY", refund);
          }
        }
        await db.payment.update({ where: { id: payment.id }, data: { lastSyncedAt: now } });
      } catch (error) {
        console.warn(`[reconcile] payment ${payment.providerPaymentId}:`, (error as Error).message);
      }
    }
  }

  const refunds = await db.refund.findMany({
    where: {
      status: "PROCESSING",
      updatedAt: { lte: new Date(now.getTime() - 10 * MINUTE) },
      payment: { providerPaymentId: { not: null } },
    },
    include: { payment: { select: { provider: true, providerPaymentId: true } } },
    take: 100,
  });
  for (const refund of refunds) {
    const provider = refund.payment!.provider;
    const refundGateway = provider === "RAZORPAY" || provider === "TEST" ? gatewayFor(provider) : null;
    if (!refundGateway) continue;
    try {
      const remote = (await refundGateway.fetchRefunds(refund.payment!.providerPaymentId!)).find(
        (r) => r.id === refund.providerRefundId,
      );
      if (remote) await applyGatewayRefund(provider as GatewayName, remote);
      // Touch it so it is not asked about again for a while.
      await db.refund.updateMany({ where: { id: refund.id, status: "PROCESSING" }, data: { updatedAt: now } });
      checked++;
    } catch (error) {
      console.warn(`[reconcile] refund ${refund.refundNumber}:`, (error as Error).message);
    }
  }

  return { checked, flagged };
}
