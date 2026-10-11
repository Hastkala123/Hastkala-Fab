import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { isAdminRole } from "@/lib/auth";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { ticketReplySchema, ticketSchema } from "@/lib/validators";
import { generateTicketNumber } from "@/lib/utils";

export const runtime = "nodejs";

/** POST — open a new support ticket. */
export const POST = handler(async (request) => {
  const gate = await guard({
    auth: "user",
    csrf: true,
    limit: { bucket: "ticket", ...RATE_LIMITS.ticket },
  });
  if (!gate.ok) return gate.response;

  const user = gate.ctx.user!;

  const parsed = await parseJson(request, ticketSchema);
  if (!parsed.ok) return parsed.response;

  const { subject, category, orderNumber, message } = parsed.data;

  // If the customer referenced an order, confirm it is actually theirs before
  // attaching it — otherwise the ticket could be used to probe order numbers.
  let verifiedOrderNumber: string | null = null;
  if (orderNumber) {
    const order = await db.order.findFirst({
      where: { orderNumber, userId: user.id },
      select: { orderNumber: true },
    });
    if (!order) {
      return fail("Please correct the highlighted fields", 422, {
        orderNumber: "We could not find that order number on your account.",
      });
    }
    verifiedOrderNumber = order.orderNumber;
  }

  const ticket = await db.helpTicket.create({
    data: {
      ticketNumber: generateTicketNumber(),
      userId: user.id,
      subject,
      category,
      orderNumber: verifiedOrderNumber,
      priority: category === "PAYMENT" ? "HIGH" : "NORMAL",
      messages: {
        create: {
          authorRole: "CUSTOMER",
          authorName: user.name,
          body: message,
        },
      },
    },
    select: { id: true, ticketNumber: true },
  });

  return ok({ ticket }, 201);
});

/** PATCH — append a reply to an existing ticket. */
export const PATCH = handler(async (request) => {
  const gate = await guard({
    auth: "user",
    csrf: true,
    limit: { bucket: "ticket-reply", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const user = gate.ctx.user!;
  const admin = isAdminRole(user.role);

  const parsed = await parseJson(request, ticketReplySchema);
  if (!parsed.ok) return parsed.response;

  // Admins may reply to any ticket; customers only to their own.
  const ticket = await db.helpTicket.findFirst({
    where: admin
      ? { id: parsed.data.ticketId }
      : { id: parsed.data.ticketId, userId: user.id },
    select: { id: true, status: true },
  });
  if (!ticket) return fail("Ticket not found.", 404);

  if (ticket.status === "CLOSED") {
    return fail("This ticket is closed. Please open a new one.", 409);
  }

  await db.$transaction([
    db.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorRole: admin ? "ADMIN" : "CUSTOMER",
        authorName: admin ? "Hastkala Fab Support" : user.name,
        body: parsed.data.body,
      },
    }),
    db.helpTicket.update({
      where: { id: ticket.id },
      data: { status: admin ? "IN_PROGRESS" : "OPEN" },
    }),
  ]);

  return ok({ success: true }, 201);
});
