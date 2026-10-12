import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { wholesaleApplicationSchema } from "@/lib/validators";
import { submitApplication } from "@/server/wholesale/account";

export const runtime = "nodejs";

/** Apply for wholesale, re-apply after a rejection, or update business details. */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "wholesale-apply", ...RATE_LIMITS.wholesaleApply } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, wholesaleApplicationSchema);
  if (!parsed.ok) return parsed.response;
  return ok(await submitApplication(gate.ctx.user!, parsed.data));
});
