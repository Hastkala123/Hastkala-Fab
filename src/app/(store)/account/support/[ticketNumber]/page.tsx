import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUserPage } from "@/server/auth/page-guard";
import { formatDateTime, TICKET_CATEGORY_LABELS, TICKET_STATUS_LABELS } from "@/lib/utils";
import TicketReply from "./TicketReply";

export const metadata: Metadata = {
  title: "Support Ticket",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ ticketNumber: string }>;
}) {
  const { ticketNumber } = await params;
  const user = await requireUserPage();

  // Scoped to the owner: a ticket number alone must not expose a conversation.
  const ticket = await db.supportTicket.findFirst({
    where: { ticketNumber, userId: user.id },
    include: {
      messages: { where: { isInternal: false }, orderBy: { createdAt: "asc" } },
      order: { select: { orderNumber: true } },
    },
  });

  if (!ticket) notFound();

  return (
    <div>
      <Link href="/account/support" className="hf-link text-sm font-semibold">
        ← All tickets
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
            {ticket.subject}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {ticket.ticketNumber} · {(TICKET_CATEGORY_LABELS[ticket.category] ?? ticket.category).toLowerCase()}
            {ticket.order && ` · order ${ticket.order.orderNumber}`}
          </p>
        </div>
        <span className="hf-badge text-indigo-ink-700">
          {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
        </span>
      </div>

      <ul className="mt-6 space-y-4">
        {ticket.messages.map((message) => {
          const fromSupport = message.authorType === "STAFF";
          return (
            <li
              key={message.id}
              className={`hf-card p-4 ${
                fromSupport ? "border-indigo-ink-200 bg-indigo-ink-50" : ""
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-bold text-indigo-ink-900">
                  {fromSupport ? "Hastkala Fab Support" : message.authorName}
                </p>
                <time
                  dateTime={message.createdAt.toISOString()}
                  className="text-xs text-slate-400"
                >
                  {formatDateTime(message.createdAt)}
                </time>
              </div>
              {/*
                Rendered as text, never as HTML. React escapes this by default —
                the whitespace class preserves the author's line breaks without
                interpreting any markup they may have typed.
              */}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {message.body}
              </p>
            </li>
          );
        })}
      </ul>

      {ticket.status === "CLOSED" ? (
        <p className="mt-6 rounded-lg bg-cotton-100 px-4 py-3 text-sm text-slate-600">
          This ticket is closed. If you still need help, please{" "}
          <Link href="/account/support#new-ticket" className="hf-link font-semibold">
            raise a new ticket
          </Link>
          .
        </p>
      ) : (
        <div className="mt-6">
          <TicketReply ticketId={ticket.id} />
        </div>
      )}
    </div>
  );
}
