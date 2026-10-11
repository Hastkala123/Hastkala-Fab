import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { orderNoteSchema } from "@/lib/validators";
import { addStaffNote } from "@/server/orders/service";

export const runtime = "nodejs";

/** Internal note on the order timeline (never shown to the customer). */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "staff", permission: "orders.view", limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, orderNoteSchema);
  if (!parsed.ok) return parsed.response;

  await addStaffNote(parsed.data.orderId, gate.ctx.user!, parsed.data.note);
  return ok({ success: true }, 201);
});
