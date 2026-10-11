import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { ticketReplySchema, ticketSchema } from "@/lib/validators";
import { formatTicketNumber } from "@/server/numbering/format";
import { nextSequence } from "@/server/numbering/sequence";

export const runtime = "nodejs";

/** Open a support ticket. */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "ticket", ...RATE_LIMITS.ticket } });
  if (!gate.ok) return gate.response;
  const user = gate.ctx.user!;

  const parsed = await parseJson(request, ticketSchema);
  if (!parsed.ok) return parsed.response;
  const { subject, category, orderNumber, message } = parsed.data;

  // Only the shopper's own orders can be attached, so tickets can't probe order numbers.
  let orderId: string | null = null;
  if (orderNumber) {
    const order = await db.order.findFirst({
      where: { orderNumber: orderNumber.toUpperCase(), userId: user.id },
      select: { id: true },
    });
    if (!order) {
      return fail("Please correct the highlighted fields", 422, {
        orderNumber: "We couldn't find that order number on your account.",
      });
    }
    orderId = order.id;
  }

  const ticket = await db.$transaction(async (tx) =>
    tx.supportTicket.create({
      data: {
        ticketNumber: formatTicketNumber(await nextSequence(tx, "ticket")),
        userId: user.id,
        orderId,
        subject,
        category,
        priority: category === "PAYMENT" ? "HIGH" : "NORMAL",
        messages: { create: { authorType: "CUSTOMER", authorId: user.id, authorName: user.name, body: message } },
      },
      select: { ticketNumber: true },
    }),
  );

  return ok({ ticket }, 201);
});

/** The shopper replies on their own ticket. Staff reply from admin. */
export const PATCH = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "ticket-reply", ...RATE_LIMITS.writeApi } });
  if (!gate.ok) return gate.response;
  const user = gate.ctx.user!;

  const parsed = await parseJson(request, ticketReplySchema.pick({ ticketId: true, body: true }));
  if (!parsed.ok) return parsed.response;

  const ticket = await db.supportTicket.findFirst({
    where: { id: parsed.data.ticketId, userId: user.id },
    select: { id: true, status: true },
  });
  if (!ticket) return fail("Ticket not found.", 404);
  if (ticket.status === "CLOSED") return fail("This ticket is closed. Please open a new one.", 409);

  await db.$transaction([
    db.ticketMessage.create({
      data: { ticketId: ticket.id, authorType: "CUSTOMER", authorId: user.id, authorName: user.name, body: parsed.data.body },
    }),
    db.supportTicket.update({ where: { id: ticket.id }, data: { status: "OPEN", closedAt: null } }),
  ]);

  return ok({ success: true }, 201);
});
