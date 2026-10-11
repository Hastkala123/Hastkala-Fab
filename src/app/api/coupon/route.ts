import { z } from "zod";
import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { getCart, isCouponUsable } from "@/lib/cart";
import { computeDiscount } from "@/lib/money";
import { RATE_LIMITS } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * POST — validate a coupon against the caller's live cart.
 *
 * This only previews the discount. The authoritative re-check happens inside
 * the checkout transaction, so a coupon that expires between preview and
 * submit still cannot be redeemed.
 */
export const POST = handler(async (request) => {
  const gate = await guard({
    auth: "user",
    csrf: true,
    limit: { bucket: "coupon", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const user = gate.ctx.user!;

  const parsed = await parseJson(
    request,
    z.object({
      code: z.string().trim().toUpperCase().min(3).max(30),
    }),
  );
  if (!parsed.ok) return parsed.response;

  const cart = await getCart();
  if (cart.lines.length === 0) return fail("Your cart is empty.", 422);

  const coupon = await db.coupon.findUnique({ where: { code: parsed.data.code } });
  if (!coupon) return fail("That coupon code is not valid.", 404);

  const usable = isCouponUsable(coupon, cart.subtotal, cart.orderType);
  if (!usable.ok) return fail(usable.reason, 422);

  // Per-user cap: count how many non-cancelled orders already used this code.
  const priorUses = await db.order.count({
    where: {
      userId: user.id,
      couponCode: coupon.code,
      status: { not: "CANCELLED" },
    },
  });
  if (priorUses >= coupon.perUserLimit) {
    return fail("You have already used this coupon.", 422);
  }

  const discount = computeDiscount(coupon, cart.subtotal);

  return ok({
    code: coupon.code,
    description: coupon.description,
    discount,
  });
});
