import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { paymentOrderSchema } from "@/lib/validators";
import { refreshOrderPayment } from "@/server/payments/service";

export const runtime = "nodejs";

/** Asks the gateway about an unpaid order (after the payment window closes, or "Check again"). */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "payment", ...RATE_LIMITS.payment } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, paymentOrderSchema);
  if (!parsed.ok) return parsed.response;
  return ok(await refreshOrderPayment(gate.ctx.user!, parsed.data.orderNumber));
});
