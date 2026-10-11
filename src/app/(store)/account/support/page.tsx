import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUserPage } from "@/server/auth/page-guard";
import { formatDate, TICKET_CATEGORY_LABELS, TICKET_STATUS_LABELS } from "@/lib/utils";
import NewTicketForm from "./NewTicketForm";

export const metadata: Metadata = {
  title: "My Support Tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TICKET_STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  WAITING_ON_CUSTOMER: "bg-amber-50 text-amber-800",
  RESOLVED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-600",
};

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const user = await requireUserPage();
  const { order } = await searchParams;
  const orderNumber = typeof order === "string" && /^HF-\d{6,9}$/.test(order) ? order : "";

  const tickets = await db.supportTicket.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: { where: { isInternal: false }, orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: { where: { isInternal: false } } } },
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950 sm:text-3xl">
            Support tickets
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {tickets.length === 0
              ? "No tickets raised yet."
              : `${tickets.length} ${tickets.length === 1 ? "ticket" : "tickets"}`}
          </p>
        </div>
        <a href="#new-ticket" className="hf-btn hf-btn-primary">
          Raise a new ticket
        </a>
      </div>

      {tickets.length === 0 ? (
        <div className="hf-card mt-6 p-10 text-center">
          <p className="text-sm text-slate-500">
            If you have a question about an order, a return or a wholesale enquiry,
            raise a ticket below and our team will get back to you.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/account/support/${ticket.ticketNumber}`}
                className="hf-card block p-4 transition hover:border-indigo-ink-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-indigo-ink-900">
                      {ticket.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {ticket.ticketNumber} · {(TICKET_CATEGORY_LABELS[ticket.category] ?? ticket.category).toLowerCase()} ·{" "}
                      {ticket._count.messages}{" "}
                      {ticket._count.messages === 1 ? "message" : "messages"}
                    </p>
                    {ticket.messages[0] && (
                      <p className="hf-clamp-1 mt-1.5 text-xs text-slate-500">
                        <strong>
                          {ticket.messages[0].authorType === "STAFF" ? "Support" : "You"}:
                        </strong>{" "}
                        {ticket.messages[0].body}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`hf-badge ${TICKET_STATUS_STYLES[ticket.status] ?? ""}`}
                    >
                      {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                    </span>
                    <time
                      dateTime={ticket.updatedAt.toISOString()}
                      className="text-xs text-slate-400"
                    >
                      {formatDate(ticket.updatedAt)}
                    </time>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <section id="new-ticket" className="hf-card mt-8 scroll-mt-24 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-indigo-ink-950">Raise a new ticket</h2>
        <div className="mt-4">
          <NewTicketForm orderNumber={orderNumber} />
        </div>
      </section>
    </div>
  );
}
