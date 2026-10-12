import "server-only";

import { db } from "@/lib/db";
import { changeOrderStatus } from "@/server/orders/service";
import { TransitionError } from "@/server/orders/transitions";
import { isAwaitingPayment, syncOrderPayments } from "./service";

/**
 * Unpaid online orders give their stock back when the payment window ends
 * (fixes C3). Before cancelling, the gateway is asked once more — a payment
 * may have gone through without its webhook reaching us.
 */

/** Extra time after the window, for a payment the shopper is just finishing. */
export const EXPIRY_GRACE_MS = 3 * 60_000;
/** If the gateway can't be reached for this long after the window, release the stock anyway (a late payment is then refunded). */
const GATEWAY_DOWN_LIMIT_MS = 2 * 60 * 60_000;

export async function expireOrderIfDue(orderId: string, now = new Date()): Promise<boolean> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true, paymentDueBy: true } });
  if (!order || !isAwaitingPayment(order.status) || !order.paymentDueBy) return false;
  const overdueBy = now.getTime() - order.paymentDueBy.getTime();
  if (overdueBy < EXPIRY_GRACE_MS) return false;

  try {
    await syncOrderPayments(orderId);
  } catch (error) {
    console.warn(`[expiry] could not check order ${orderId} with the gateway:`, (error as Error).message);
    if (overdueBy < GATEWAY_DOWN_LIMIT_MS) return false; // try again next run
  }

  const fresh = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!fresh || !isAwaitingPayment(fresh.status)) return false;
  try {
    await changeOrderStatus(orderId, "CANCELLED", { type: "SYSTEM", user: null }, {
      expectedFrom: fresh.status,
      restockReason: "ORDER_EXPIRED",
      cancelReason: "Payment not completed in time",
      note: "The payment wasn't completed in time, so the items were released.",
    });
    return true;
  } catch (error) {
    if (error instanceof TransitionError) return false; // paid at the last moment
    throw error;
  }
}

/** Scheduler task: expires every order whose payment window (plus grace) has ended. */
export async function expireUnpaidOrders(now = new Date(), limit = 25): Promise<number> {
  const due = await db.order.findMany({
    where: {
      status: { in: ["PENDING_PAYMENT", "PAYMENT_FAILED"] },
      paymentDueBy: { lte: new Date(now.getTime() - EXPIRY_GRACE_MS) },
    },
    orderBy: { paymentDueBy: "asc" },
    take: limit,
    select: { id: true },
  });
  let expired = 0;
  for (const { id } of due) {
    try {
      if (await expireOrderIfDue(id, now)) expired++;
    } catch (error) {
      console.error(`[expiry] order ${id} could not be expired:`, error);
    }
  }
  return expired;
}
