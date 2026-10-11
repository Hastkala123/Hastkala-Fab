import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { applyCouponSchema } from "@/lib/validators";
import { applyCoupon } from "@/server/cart";

export const runtime = "nodejs";

/**
 * Apply ({ code }) or remove ({ code: null }) a coupon on the bag. This checks
 * it against the bag as it is now; the checkout transaction checks again and
 * claims a use atomically, so a coupon that runs out in between can't be used.
 */
export const POST = handler(async (request) => {
  const gate = await guard({ limit: { bucket: "coupon", ...RATE_LIMITS.coupon } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, applyCouponSchema);
  if (!parsed.ok) return parsed.response;

  const view = await applyCoupon(parsed.data.code || null);
  return ok({
    code: view.couponCode,
    discount: view.quote.discountTotal,
    freeShipping: view.quote.coupon?.freeShipping ?? false,
    total: view.quote.grandTotal,
  });
});
