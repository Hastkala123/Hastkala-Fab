import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Support Tickets" };
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  OPEN: "text-amber-700",
  IN_PROGRESS: "text-blue-700",
  RESOLVED: "text-emerald-700",
  CLOSED: "text-slate-500",
};

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const statuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  const filter = params.status && statuses.includes(params.status) ? params.status : null;

  const [tickets, counts] = await Promise.all([
    db.helpTicket.findMany({
      where: filter ? { status: filter } : {},
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 50,
      include: {
        user: { select: { name: true, email: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: true } },
      },
    }),
    db.helpTicket.groupBy({ by: ["status"], _count: { id: true } }),
  ]);

  const countFor = (status: string) =>
    counts.find((c) => c.status === status)?._count.id ?? 0;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
        Support tickets
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Customer enquiries. Respond within one working day to meet the service
        commitment published in the Help Centre.
      </p>

      <nav aria-label="Filter tickets" className="mt-5 flex flex-wrap gap-1.5">
        <Link
          href="/admin/tickets"
          className={
            !filter
              ? "hf-btn hf-btn-primary py-1.5 text-sm"
              : "hf-btn hf-btn-outline py-1.5 text-sm"
          }
        >
          All ({counts.reduce((sum, c) => sum + c._count.id, 0)})
        </Link>
        {statuses.map((status) => (
          <Link
            key={status}
            href={`/admin/tickets?status=${status}`}
            className={
              filter === status
                ? "hf-btn hf-btn-primary py-1.5 text-sm"
                : "hf-btn hf-btn-outline py-1.5 text-sm"
            }
          >
            {status.replace("_", " ")} ({countFor(status)})
          </Link>
        ))}
      </nav>

      {tickets.length === 0 ? (
        <div className="hf-card mt-6 p-12 text-center">
          <p className="text-sm text-slate-500">No tickets match this filter.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/admin/tickets/${ticket.ticketNumber}`}
                className="hf-card block p-4 transition hover:border-indigo-ink-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-indigo-ink-900">
                        {ticket.subject}
                      </p>
                      {ticket.priority === "HIGH" && (
                        <span className="hf-badge text-madder-600">High priority</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {ticket.ticketNumber} · {ticket.user.name} ({ticket.user.email})
                      {ticket.orderNumber && ` · order ${ticket.orderNumber}`}
                    </p>
                    {ticket.messages[0] && (
                      <p className="hf-clamp-1 mt-1.5 text-xs text-slate-500">
                        <strong>
                          {ticket.messages[0].authorRole === "ADMIN" ? "You" : "Customer"}:
                        </strong>{" "}
                        {ticket.messages[0].body}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`hf-badge ${STATUS_STYLES[ticket.status] ?? ""}`}>
                      {ticket.status.replace("_", " ")}
                    </span>
                    <span className="text-xs text-slate-400">
                      {ticket._count.messages} messages
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
