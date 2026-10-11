/**
 * Money utilities. Everything internal is an integer number of paise.
 *
 * Rule for the whole codebase: never let a rupee float touch a total. Convert
 * at the edges (form input in, display out) and stay in paise in between.
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
  return paise % 100 === 0
    ? inrFormatter.format(rupees)
    : inrFormatterPrecise.format(rupees);
}

export function discountPercent(mrp: number, price: number): number {
  if (mrp <= 0 || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

// ---------------------------------------------------------------------------
// Shipping & tax policy
// ---------------------------------------------------------------------------

export const FREE_SHIPPING_THRESHOLD = 99900; // ₹999
export const STANDARD_SHIPPING_FEE = 7900; // ₹79
/** Textiles under ₹1000 attract 5% GST; at or above, 12%. */
const GST_LOW = 5;
const GST_HIGH = 12;
const GST_SLAB_BOUNDARY = 100000; // ₹1000 per item

export function shippingFeeFor(subtotal: number, orderType: string): number {
  // Wholesale ships freight-on-delivery, arranged per consignment.
  if (orderType === "WHOLESALE") return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
}

/**
 * GST on Indian textiles is slabbed by per-item value, so tax is computed per
 * line rather than on the order total.
 */
export function taxFor(lines: { unitPrice: number; quantity: number }[]): number {
  return lines.reduce((sum, line) => {
    const rate = line.unitPrice >= GST_SLAB_BOUNDARY ? GST_HIGH : GST_LOW;
    return sum + Math.round((line.unitPrice * line.quantity * rate) / 100);
  }, 0);
}

export type CouponLike = {
  type: string;
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
};

/** Returns the discount in paise, clamped so it can never exceed the subtotal. */
export function computeDiscount(coupon: CouponLike, subtotal: number): number {
  if (subtotal < coupon.minOrderValue) return 0;

  let discount =
    coupon.type === "PERCENT"
      ? Math.round((subtotal * coupon.value) / 100)
      : coupon.value;

  if (coupon.type === "PERCENT" && coupon.maxDiscount != null) {
    discount = Math.min(discount, coupon.maxDiscount);
  }

  return Math.max(0, Math.min(discount, subtotal));
}
