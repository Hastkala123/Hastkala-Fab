import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { checkoutSchema } from "@/lib/validators";
import { placeOrder } from "@/server/orders/checkout";

export const runtime = "nodejs";

/**
 * Places the order for the signed-in shopper's bag. Every price, tax and fee
 * is recomputed inside the transaction; the request only says where to
 * deliver, how to pay, and carries a one-time key so a double submit can't
 * create two orders.
 */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "checkout", ...RATE_LIMITS.checkout } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, checkoutSchema);
  if (!parsed.ok) return parsed.response;

  const placed = await placeOrder(gate.ctx.user!, parsed.data);
  return ok(placed, placed.reused ? 200 : 201);
});
