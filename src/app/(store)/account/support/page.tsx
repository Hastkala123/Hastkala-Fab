import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My Support Tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TICKET_STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-600",
};

export default async function SupportPage() {
  const user = await requireUser();

  const tickets = await db.helpTicket.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
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
        <Link href="/help" className="hf-btn hf-btn-primary">
          Raise a new ticket
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="hf-card mt-6 p-10 text-center">
          <p className="text-sm text-slate-500">
            If you have a question about an order, a return or a wholesale enquiry,
            raise a ticket and our team will respond within one working day.
          </p>
          <Link href="/help" className="hf-btn hf-btn-outline mt-5">
            Go to Help Centre
          </Link>
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
                      {ticket.ticketNumber} · {ticket.category.toLowerCase()} ·{" "}
                      {ticket._count.messages}{" "}
                      {ticket._count.messages === 1 ? "message" : "messages"}
                    </p>
                    {ticket.messages[0] && (
                      <p className="hf-clamp-1 mt-1.5 text-xs text-slate-500">
                        <strong>
                          {ticket.messages[0].authorRole === "ADMIN" ? "Support" : "You"}:
                        </strong>{" "}
                        {ticket.messages[0].body}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`hf-badge ${TICKET_STATUS_STYLES[ticket.status] ?? ""}`}
                    >
                      {ticket.status.replace("_", " ")}
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
    </div>
  );
}
