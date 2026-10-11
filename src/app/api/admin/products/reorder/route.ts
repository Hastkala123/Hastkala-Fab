import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { reorderSchema } from "@/lib/validators";
import { reorder } from "@/server/catalog/admin";

export const runtime = "nodejs";

/** Saves the drag-and-drop order used by "Recommended" sorting. */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "staff", permission: "catalog.manage", limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, reorderSchema);
  if (!parsed.ok) return parsed.response;

  await reorder("product", parsed.data.ids, gate.ctx.user!);
  return ok({ success: true });
});
