import type { PaymentAttemptStatus, PaymentStatus } from "@prisma/client";

/**
 * Order-level payment status, worked out from money in and money out
 * (docs/phase-1/05-state-machines.md §2). Pure, so it is unit-tested.
 */
export function orderPaymentStatus(input: {
  grandTotal: number;
  amountPaid: number;
  amountRefunded: number;
  /** Used while nothing has been paid: PENDING or FAILED. */
  unpaidStatus: "PENDING" | "FAILED";
}): PaymentStatus {
  const { grandTotal, amountPaid, amountRefunded } = input;
  if (amountPaid <= 0) return input.unpaidStatus;
  const kept = amountPaid - amountRefunded;
  if (kept <= 0) return "REFUNDED";
  // A second, duplicate payment that was refunded still leaves the order paid.
  if (kept >= grandTotal) return "PAID";
  return amountRefunded > 0 ? "PARTIALLY_REFUNDED" : "PARTIALLY_PAID";
}

/** A captured attempt after refunds. */
export function attemptStatusAfterRefunds(amount: number, amountRefunded: number): PaymentAttemptStatus {
  if (amountRefunded <= 0) return "CAPTURED";
  return amountRefunded >= amount ? "REFUNDED" : "PARTIALLY_REFUNDED";
}

/** How far along an attempt is. A failed attempt can still succeed later (late authorisation). */
export const ATTEMPT_RANK: Record<PaymentAttemptStatus, number> = {
  CREATED: 0,
  FAILED: 1,
  AUTHORIZED: 2,
  CAPTURED: 3,
  PARTIALLY_REFUNDED: 4,
  REFUNDED: 5,
};

export const isCaptured = (status: PaymentAttemptStatus) => ATTEMPT_RANK[status] >= ATTEMPT_RANK.CAPTURED;

/**
 * What must be paid before an awaiting order is confirmed: the advance on
 * "advance + balance" terms, otherwise the whole order.
 */
export function confirmThreshold(order: { grandTotal: number; advanceAmount: number }): number {
  return order.advanceAmount > 0 && order.advanceAmount < order.grandTotal ? order.advanceAmount : order.grandTotal;
}
