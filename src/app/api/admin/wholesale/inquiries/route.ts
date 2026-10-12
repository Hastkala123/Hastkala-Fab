import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { inquiryUpdateSchema } from "@/lib/validators";
import { updateInquiry } from "@/server/wholesale/admin";

export const runtime = "nodejs";

/** Lead status (new → contacted → converted / closed) and notes. */
export const PATCH = handler(async (request) => {
  const gate = await guard({
    auth: "staff",
    permission: "wholesale.manage",
    limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite },
  });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, inquiryUpdateSchema);
  if (!parsed.ok) return parsed.response;
  await updateInquiry(gate.ctx.user!, parsed.data);
  return ok({ success: true });
});
