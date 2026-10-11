/**
 * Money display. Everything internal is an integer number of paise; prices,
 * tax and totals are computed in src/server/orders/quote.ts and
 * src/server/tax/gst.ts, never here.
 */

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrFormatterPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats paise as ₹1,299 — or ₹1,299.50 when there is a paise remainder. */
export function formatPrice(paise: number): string {
  const rupees = paiseToRupees(paise);
  return paise % 100 === 0 ? inrFormatter.format(rupees) : inrFormatterPrecise.format(rupees);
}

/** Always two decimals, for invoices and GST breakdowns. */
export function formatPricePrecise(paise: number): string {
  return inrFormatterPrecise.format(paiseToRupees(paise));
}

export function discountPercent(mrp: number, price: number): number {
  if (mrp <= 0 || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

/** 500 → "5%", 250 → "2.5%". */
export function formatRate(rateBps: number): string {
  return `${rateBps / 100}%`;
}
