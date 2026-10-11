/**
 * Coupon eligibility and discount maths. Pure — the caller loads the coupon
 * and the shopper's history; the checkout transaction re-runs this and then
 * claims the coupon with a conditional update (see orders/checkout.ts).
 */

export type CouponType = "PERCENT" | "FLAT" | "FREE_SHIPPING";
export type Audience = "ALL" | "RETAIL" | "WHOLESALE";
export type CustomerType = "RETAIL" | "WHOLESALE";

export type CouponDef = {
  code: string;
  type: CouponType;
  /** Whole percent for PERCENT, paise for FLAT, ignored for FREE_SHIPPING. */
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
  audience: Audience;
  firstOrderOnly: boolean;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number;
  startsAt: Date;
  endsAt: Date | null;
  isActive: boolean;
  /** Empty = every category. */
  categoryIds: string[];
};

export type CouponContext = {
  now: Date;
  customerType: CustomerType;
  /** Coupons need a known shopper (account or verified phone) for per-user limits. */
  shopperKnown: boolean;
  priorRedemptionsByShopper: number;
  shopperHasPriorOrders: boolean;
  /** Item subtotal of the whole order, paise. */
  orderSubtotal: number;
  /** Item subtotal of lines in the coupon's categories, paise. */
  eligibleSubtotal: number;
};

export type CouponResult =
  | { ok: true; discount: number; freeShipping: boolean }
  | { ok: false; reason: string };

const rupees = (paise: number) =>
  `₹${Math.ceil(paise / 100).toLocaleString("en-IN")}`;

export function evaluateCoupon(coupon: CouponDef, ctx: CouponContext): CouponResult {
  if (!coupon.isActive) return { ok: false, reason: "This coupon is no longer active." };
  if (coupon.startsAt > ctx.now) return { ok: false, reason: "This coupon is not active yet." };
  if (coupon.endsAt && coupon.endsAt < ctx.now) {
    return { ok: false, reason: "This coupon has expired." };
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: "This coupon has been fully used." };
  }
  if (coupon.audience !== "ALL" && coupon.audience !== ctx.customerType) {
    return {
      ok: false,
      reason:
        coupon.audience === "WHOLESALE"
          ? "This coupon is for wholesale buyers only."
          : "This coupon is for retail orders only.",
    };
  }
  if (!ctx.shopperKnown) {
    return { ok: false, reason: "Sign in or verify your phone number to use a coupon." };
  }
  if (ctx.priorRedemptionsByShopper >= coupon.perUserLimit) {
    return {
      ok: false,
      reason:
        coupon.perUserLimit === 1
          ? "You have already used this coupon."
          : `You have already used this coupon ${coupon.perUserLimit} times.`,
    };
  }
  if (coupon.firstOrderOnly && ctx.shopperHasPriorOrders) {
    return { ok: false, reason: "This coupon is for your first order only." };
  }
  if (ctx.eligibleSubtotal <= 0) {
    return { ok: false, reason: "This coupon does not apply to the items in your bag." };
  }
  if (ctx.orderSubtotal < coupon.minOrderValue) {
    return {
      ok: false,
      reason: `Add ${rupees(coupon.minOrderValue - ctx.orderSubtotal)} more to use this coupon.`,
    };
  }

  if (coupon.type === "FREE_SHIPPING") return { ok: true, discount: 0, freeShipping: true };

  let discount =
    coupon.type === "PERCENT"
      ? Math.floor((ctx.eligibleSubtotal * coupon.value) / 100)
      : coupon.value;
  if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.max(0, Math.min(discount, ctx.eligibleSubtotal));

  return { ok: true, discount, freeShipping: false };
}
