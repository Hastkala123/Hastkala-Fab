import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { ticketReplySchema } from "@/lib/validators";

export const runtime = "nodejs";

/** Staff reply (or internal note) on a ticket, optionally changing its status. */
export const PATCH = handler(async (request) => {
  const gate = await guard({ auth: "staff", permission: "support.manage", limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite } });
  if (!gate.ok) return gate.response;
  const staff = gate.ctx.user!;

  const parsed = await parseJson(request, ticketReplySchema);
  if (!parsed.ok) return parsed.response;
  const { ticketId, body, isInternal, status } = parsed.data;

  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true, status: true } });
  if (!ticket) return fail("Ticket not found.", 404);

  const nextStatus = status ?? (isInternal ? ticket.status : "WAITING_ON_CUSTOMER");
  await db.$transaction([
    db.ticketMessage.create({
      data: { ticketId, authorType: "STAFF", authorId: staff.id, authorName: isInternal ? staff.name : "Hastkala Fab Support", body, isInternal },
    }),
    db.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: nextStatus,
        assignedToId: staff.id,
        closedAt: nextStatus === "CLOSED" || nextStatus === "RESOLVED" ? new Date() : null,
      },
    }),
  ]);
  return ok({ success: true }, 201);
});
