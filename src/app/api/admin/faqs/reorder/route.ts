import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { reorderSchema } from "@/lib/validators";
import { reorderFaqs } from "@/server/content/admin";

export const runtime = "nodejs";

/** Saves the drag-and-drop order of FAQs. */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "staff", permission: "content.manage", limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, reorderSchema);
  if (!parsed.ok) return parsed.response;
  await reorderFaqs(gate.ctx.user!, parsed.data.ids);
  return ok({ success: true });
});
