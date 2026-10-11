import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatIndianMobile } from "@/lib/phone";
import { formatDateTime, TICKET_CATEGORY_LABELS, TICKET_STATUS_LABELS } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/page-guard";
import StaffReply from "./StaffReply";

export const metadata: Metadata = { title: "Support ticket" };
export const dynamic = "force-dynamic";

export default async function AdminTicketPage({ params }: { params: Promise<{ ticketNumber: string }> }) {
  await requireStaffPage("support.manage");
  const { ticketNumber } = await params;
  const ticket = await db.supportTicket.findUnique({
    where: { ticketNumber },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      order: { select: { orderNumber: true, status: true } },
      messages: { orderBy: { createdAt: "asc" } },
      assignedTo: { select: { name: true } },
    },
  });
  if (!ticket) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/admin/tickets" className="hf-link text-sm font-semibold">
        ← Tickets
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {ticket.ticketNumber} · {TICKET_CATEGORY_LABELS[ticket.category] ?? ticket.category} · opened{" "}
            {formatDateTime(ticket.createdAt)}
            {ticket.assignedTo && ` · handled by ${ticket.assignedTo.name}`}
          </p>
        </div>
        <span className="hf-badge">{TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}</span>
      </div>

      <div className="hf-card mt-5 p-4 text-sm">
        {ticket.user ? (
          <p>
            <Link href={`/admin/customers/${ticket.user.id}`} className="font-semibold text-indigo-ink-900 hover:underline">
              {ticket.user.name}
            </Link>
            {ticket.user.email && ` · ${ticket.user.email}`}
            {ticket.user.phone && ` · ${formatIndianMobile(ticket.user.phone)}`}
          </p>
        ) : (
          <p>
            {ticket.guestName ?? "Guest"} {ticket.guestEmail && `· ${ticket.guestEmail}`}{" "}
            {ticket.guestPhone && `· ${ticket.guestPhone}`}
          </p>
        )}
        {ticket.order && (
          <p className="mt-1">
            Order{" "}
            <Link href={`/admin/orders/${ticket.order.orderNumber}`} className="hf-link font-semibold">
              {ticket.order.orderNumber}
            </Link>
          </p>
        )}
      </div>

      <ol className="mt-5 space-y-3">
        {ticket.messages.map((message) => (
          <li
            key={message.id}
            className={`rounded-card border p-4 ${
              message.isInternal
                ? "border-turmeric-300 bg-turmeric-50"
                : message.authorType === "STAFF"
                  ? "border-indigo-ink-200 bg-indigo-ink-50"
                  : "border-cotton-300 bg-white"
            }`}
          >
            <p className="text-xs font-semibold text-slate-600">
              {message.authorName}
              {message.isInternal && " · internal note"} · {formatDateTime(message.createdAt)}
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-800">{message.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6">
        <StaffReply ticketId={ticket.id} status={ticket.status} />
      </div>
    </div>
  );
}
