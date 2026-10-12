import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { paymentOrderSchema } from "@/lib/validators";
import { startPayment } from "@/server/payments/service";

export const runtime = "nodejs";

/** Opens (or reopens) the payment window for one of the shopper's unpaid orders. */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "payment", ...RATE_LIMITS.payment } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, paymentOrderSchema);
  if (!parsed.ok) return parsed.response;
  return ok(await startPayment(gate.ctx.user!, parsed.data.orderNumber));
});
