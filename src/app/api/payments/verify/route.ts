import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { verifyPaymentSchema } from "@/lib/validators";
import { confirmCheckoutPayment } from "@/server/payments/service";

export const runtime = "nodejs";

/**
 * Called by the payment window on success. The signature is checked, then the
 * payment is looked up at the gateway — the browser's word alone never marks
 * an order paid.
 */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "payment", ...RATE_LIMITS.payment } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, verifyPaymentSchema);
  if (!parsed.ok) return parsed.response;
  return ok(await confirmCheckoutPayment(gate.ctx.user!, parsed.data));
});
