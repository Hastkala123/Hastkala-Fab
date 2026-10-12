import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { testPaymentSchema } from "@/lib/validators";
import { simulateTestPayment } from "@/server/payments/test-checkout";

export const runtime = "nodejs";

/** The test gateway's pay / fail buttons. Answers 404 whenever the test gateway is not in use (always in production). */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "payment", ...RATE_LIMITS.payment } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, testPaymentSchema);
  if (!parsed.ok) return parsed.response;
  return ok(await simulateTestPayment(gate.ctx.user!, parsed.data));
});
