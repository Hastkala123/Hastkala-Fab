import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { wholesaleAdminSchema } from "@/lib/validators";
import { reviewApplication } from "@/server/wholesale/admin";

export const runtime = "nodejs";

/** Approve (with tier and payment terms), reject, suspend, reinstate, or change terms. */
export const PATCH = handler(async (request) => {
  const gate = await guard({
    auth: "staff",
    permission: "wholesale.manage",
    limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite },
  });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, wholesaleAdminSchema);
  if (!parsed.ok) return parsed.response;
  const { profileId, ...action } = parsed.data;
  await reviewApplication(gate.ctx.user!, profileId, action);
  return ok({ success: true });
});
