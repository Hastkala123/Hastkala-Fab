import "server-only";

import { db } from "@/lib/db";
import { buyerTerms, outstandingBalance } from "./account";

/**
 * The buyer's account statement (khata): what each order cost, what has been
 * paid, what is still due and by when, and every payment and refund.
 */
export async function buyerLedger(userId: string, now = new Date()) {
  const [orders, payments, refunds, terms, outstanding] = await Promise.all([
    db.order.findMany({
      where: {
        userId,
        paymentMethod: { not: "COD" },
        NOT: { status: "CANCELLED", amountPaid: 0 },
      },
      orderBy: { placedAt: "desc" },
      take: 200,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        placedAt: true,
        grandTotal: true,
        amountPaid: true,
        amountRefunded: true,
        paymentMethod: true,
        paymentTerms: true,
        advanceAmount: true,
        paymentDueBy: true,
        balanceDueAt: true,
      },
    }),
    db.payment.findMany({
      where: {
        order: { userId },
        OR: [
          { status: { in: ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"] } },
          { provider: "MANUAL", status: { in: ["CREATED", "FAILED"] } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        provider: true,
        method: true,
        status: true,
        amount: true,
        manualReference: true,
        failureReason: true,
        capturedAt: true,
        createdAt: true,
        order: { select: { orderNumber: true } },
      },
    }),
    db.refund.findMany({
      where: { order: { userId } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { refundNumber: true, amount: true, status: true, createdAt: true, order: { select: { orderNumber: true } } },
    }),
    buyerTerms(db, userId),
    outstandingBalance(db, userId),
  ]);

  const rows = orders.map((order) => {
    const paid = order.amountPaid - order.amountRefunded;
    const balance = order.status === "CANCELLED" ? 0 : Math.max(order.grandTotal - paid, 0);
    const awaiting = order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_FAILED";
    const dueAt = awaiting ? order.paymentDueBy : order.balanceDueAt;
    return { ...order, paid, balance, awaiting, dueAt, overdue: balance > 0 && !awaiting && dueAt != null && dueAt < now };
  });

  return {
    terms,
    rows,
    payments,
    refunds,
    summary: {
      outstanding,
      overdue: rows.filter((r) => r.overdue).reduce((sum, r) => sum + r.balance, 0),
      awaitingPayment: rows.filter((r) => r.awaiting).reduce((sum, r) => sum + r.balance, 0),
      totalPaid: rows.reduce((sum, r) => sum + Math.max(r.paid, 0), 0),
      creditLimit: terms?.terms === "CREDIT" ? terms.creditLimit : null,
      creditAvailable:
        terms?.terms === "CREDIT" && terms.creditLimit != null ? Math.max(terms.creditLimit - outstanding, 0) : null,
    },
  };
}
