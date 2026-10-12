import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { rateLimit, RATE_LIMITS } from "@/lib/ratelimit";
import { trackOrderSchema } from "@/lib/validators";
import { trackOrder } from "@/server/orders/track";

export const runtime = "nodejs";

/** Public order lookup for /track: order number plus the email or mobile it was placed with. */
export const POST = handler(async (request) => {
  const gate = await guard({ limit: { bucket: "track", ...RATE_LIMITS.track } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, trackOrderSchema);
  if (!parsed.ok) return parsed.response;

  // Per order too, so guesses at one order's mobile number can't be spread over many addresses.
  const perOrder = await rateLimit("track-order", parsed.data.orderNumber, 20, 60 * 60);
  if (!perOrder.allowed) return fail("Too many attempts for this order. Please try again in an hour.", 429);

  return ok({ order: await trackOrder(parsed.data) });
});
