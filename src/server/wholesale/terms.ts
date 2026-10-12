import type { PaymentMethod, WholesalePaymentTerms } from "@prisma/client";

/**
 * Wholesale payment terms, as pure functions (unit-tested): which ways to pay
 * a buyer is offered at checkout, and how much must be paid before the order
 * is confirmed.
 */

export type BuyerTerms = {
  terms: WholesalePaymentTerms;
  /** % taken up front on ADVANCE_BALANCE terms. */
  advancePercent: number;
  /** Paise; null = no limit. */
  creditLimit: number | null;
  creditDays: number;
};

/** Advance on an order, rounded up to the rupee; 0 = the full amount is due now. */
export function advanceAmount(grandTotal: number, terms: BuyerTerms | null): number {
  if (!terms || terms.terms !== "ADVANCE_BALANCE") return 0;
  const advance = Math.ceil((grandTotal * terms.advancePercent) / 100 / 100) * 100;
  return advance >= grandTotal ? 0 : advance;
}

export type MethodOption = {
  value: PaymentMethod;
  label: string;
  detail: string;
  available: boolean;
  /** Why it can't be used right now. */
  reason?: string;
};

export function paymentOptions(input: {
  wholesale: BuyerTerms | null;
  onlineAvailable: boolean;
  cod: { available: boolean; reason: string | null; fee: number };
  bankTransferEnabled: boolean;
  wholesaleCodAllowed: boolean;
  /** Credit still free for this order (paise); null = no limit. */
  creditRemaining: number | null;
  orderTotal: number;
}): MethodOption[] {
  const online = (value: PaymentMethod, label: string, detail: string): MethodOption => ({
    value,
    label,
    detail,
    available: input.onlineAvailable,
    reason: input.onlineAvailable ? undefined : "Online payment is unavailable right now",
  });
  const options: MethodOption[] = [
    online("UPI", "UPI", "GPay, PhonePe, Paytm and more"),
    online("CARD", "Credit / debit card", "Visa, Mastercard, RuPay"),
    online("NETBANKING", "Net banking", "All major Indian banks"),
  ];

  const buyer = input.wholesale;
  if (buyer) {
    if (input.bankTransferEnabled) {
      options.push({
        value: "BANK_TRANSFER",
        label: "Bank transfer (NEFT / RTGS / IMPS)",
        detail: "We hold the stock while your transfer arrives",
        available: true,
      });
    }
    if (buyer.terms === "CREDIT") {
      const fits = input.creditRemaining == null || input.orderTotal <= input.creditRemaining;
      options.push({
        value: "CREDIT",
        label: "Buy on credit",
        detail: `Pay within ${buyer.creditDays} days`,
        available: fits,
        reason: fits ? undefined : "This order is more than your remaining credit",
      });
    }
    if (input.wholesaleCodAllowed) {
      options.push({
        value: "COD",
        label: "Cash on delivery",
        detail: "Pay when it arrives",
        available: input.cod.available,
        reason: input.cod.reason ?? undefined,
      });
    }
  } else {
    options.push({
      value: "COD",
      label: "Cash on delivery",
      detail: "Pay when it arrives",
      available: input.cod.available,
      reason: input.cod.reason ?? undefined,
    });
  }
  return options;
}
