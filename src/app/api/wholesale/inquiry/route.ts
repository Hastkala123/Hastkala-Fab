import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { wholesaleInquirySchema } from "@/lib/validators";
import { createInquiry } from "@/server/wholesale/inquiry";

export const runtime = "nodejs";

/** Public wholesale enquiry form (no account needed). */
export const POST = handler(async (request) => {
  const gate = await guard({ limit: { bucket: "inquiry", ...RATE_LIMITS.inquiry } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, wholesaleInquirySchema);
  if (!parsed.ok) return parsed.response;
  const { website, ...inquiry } = parsed.data;
  // A filled honeypot is a bot: answer as if it worked, store nothing.
  if (!website) await createInquiry(inquiry);
  return ok({ success: true }, 201);
});
