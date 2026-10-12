import type { Metadata } from "next";
import Link from "next/link";
import type { PaymentAttemptStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import {
  formatDateTime,
  PAYMENT_ATTEMPT_LABELS,
  PAYMENT_ATTEMPT_STYLES,
  PAYMENT_METHOD_LABELS,
  REFUND_STAFF_LABELS,
} from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/page-guard";
import { gatewayStatus } from "@/server/payments/gateway";
import PaymentActionButton from "@/components/admin/PaymentActionButton";
import TransferReview from "@/components/admin/TransferReview";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

const STATUSES: PaymentAttemptStatus[] = ["CAPTURED", "FAILED", "CREATED", "AUTHORIZED", "PARTIALLY_REFUNDED", "REFUNDED"];

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const staff = await requireStaffPage("payments.verify");
  const params = await searchParams;
  const filter = STATUSES.find((s) => s === params.status) ?? null;

  const [attention, openRefunds, attempts, webhookProblems] = await Promise.all([
    db.payment.findMany({
      where: { attentionAt: { not: null } },
      orderBy: { attentionAt: "desc" },
      take: 50,
      include: { order: { select: { orderNumber: true } } },
    }),
    db.refund.findMany({
      where: { status: { in: ["INITIATED", "PROCESSING", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { order: { select: { orderNumber: true } } },
    }),
    db.payment.findMany({
      where: filter ? { status: filter } : {},
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { order: { select: { orderNumber: true, status: true } } },
    }),
    db.webhookEvent.findMany({
      where: { processedAt: null, error: { not: null } },
      orderBy: { receivedAt: "desc" },
      take: 20,
      select: { id: true, provider: true, eventType: true, error: true, attempts: true, receivedAt: true },
    }),
  ]);
  const gateway = gatewayStatus();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">Payments</h1>
        <p className="mt-1 text-sm text-slate-600">
          Online payments and refunds. Orders are confirmed only by the gateway&apos;s own record, and the shop checks
          its books against the gateway every hour.
        </p>
        <p className="mt-3 text-sm">
          <span className="font-semibold text-indigo-ink-900">Gateway: </span>
          {gateway.mode === "live" && <span className="text-emerald-700">Razorpay (live)</span>}
          {gateway.mode === "test-keys" && <span className="text-turmeric-800">Razorpay test mode — no real money moves</span>}
          {gateway.mode === "stand-in" && <span className="text-turmeric-800">Built-in test gateway (development only)</span>}
          {gateway.mode === "off" && <span className="text-madder-700">Not set up — online payment is switched off</span>}
          {"webhooks" in gateway && !gateway.webhooks && (
            <span className="text-madder-700"> · webhook secret missing (payments still confirm, but more slowly)</span>
          )}
        </p>
      </div>

      <section>
        <h2 className="font-display text-lg font-bold text-indigo-ink-950">Needs attention ({attention.length})</h2>
        {attention.length === 0 ? (
          <p className="hf-card mt-3 p-5 text-sm text-slate-500">Nothing to look at. 🎉</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {attention.map((payment) => (
              <li key={payment.id} className="hf-card flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <Link href={`/admin/orders/${payment.order.orderNumber}`} className="hf-link font-semibold">
                    {payment.order.orderNumber}
                  </Link>
                  <span className="ml-2 text-slate-500">{formatPrice(payment.amount)}</span>
                  <p className="mt-1 text-turmeric-900">{payment.attentionReason}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {payment.manualReference ? `UTR ${payment.manualReference}` : (payment.providerPaymentId ?? payment.providerOrderId)} · flagged{" "}
                    {formatDateTime(payment.attentionAt!)}
                  </p>
                  {payment.provider === "MANUAL" && payment.status === "CREATED" && (
                    <TransferReview paymentId={payment.id} amount={payment.amount} reference={payment.manualReference} />
                  )}
                </div>
                {!(payment.provider === "MANUAL" && payment.status === "CREATED") && (
                  <PaymentActionButton body={{ action: "resolve", paymentId: payment.id }} label="Mark resolved" />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-indigo-ink-950">Refunds in progress ({openRefunds.length})</h2>
        {openRefunds.length === 0 ? (
          <p className="hf-card mt-3 p-5 text-sm text-slate-500">No refunds waiting.</p>
        ) : (
          <div className="hf-card mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-cotton-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Refund</th>
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-cotton-200">
                {openRefunds.map((refund) => (
                  <tr key={refund.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-indigo-ink-900">{refund.refundNumber}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(refund.createdAt)}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/orders/${refund.order.orderNumber}`} className="hf-link">
                        {refund.order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-semibold">{formatPrice(refund.amount)}</td>
                    <td className="px-4 py-2.5">
                      <p className={refund.status === "FAILED" ? "font-semibold text-madder-700" : "text-slate-700"}>
                        {REFUND_STAFF_LABELS[refund.status]}
                      </p>
                      {refund.failureReason && <p className="text-xs text-madder-700">{refund.failureReason}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {refund.status === "FAILED" && can(staff, "refunds.issue") && (
                        <PaymentActionButton
                          body={{ action: "retry-refund", refundId: refund.id }}
                          label="Retry"
                          confirmText={`Send refund ${refund.refundNumber} of ${formatPrice(refund.amount)} to the gateway again?`}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {webhookProblems.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">Webhooks that failed ({webhookProblems.length})</h2>
          <p className="mt-1 text-sm text-slate-600">
            The gateway retries these by itself; the hourly check also catches anything they missed.
          </p>
          <ul className="mt-3 space-y-2">
            {webhookProblems.map((event) => (
              <li key={event.id} className="hf-card p-4 text-sm">
                <p className="font-semibold text-indigo-ink-900">
                  {event.provider} · {event.eventType}
                </p>
                <p className="mt-0.5 text-xs text-madder-700">{event.error}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {formatDateTime(event.receivedAt)} · {event.attempts} {event.attempts === 1 ? "try" : "tries"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-display text-lg font-bold text-indigo-ink-950">Recent payment attempts</h2>
        <nav aria-label="Filter payments" className="mt-3 flex flex-wrap gap-1.5">
          <Link href="/admin/payments" className={`hf-btn py-1.5 text-sm ${!filter ? "hf-btn-primary" : "hf-btn-outline"}`}>
            All
          </Link>
          {STATUSES.map((status) => (
            <Link
              key={status}
              href={`/admin/payments?status=${status}`}
              className={`hf-btn py-1.5 text-sm ${filter === status ? "hf-btn-primary" : "hf-btn-outline"}`}
            >
              {PAYMENT_ATTEMPT_LABELS[status]}
            </Link>
          ))}
        </nav>
        {attempts.length === 0 ? (
          <p className="hf-card mt-3 p-5 text-sm text-slate-500">No payment attempts match this filter.</p>
        ) : (
          <div className="hf-card mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-cotton-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Method</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cotton-200">
                {attempts.map((payment) => (
                  <tr key={payment.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                      {formatDateTime(payment.capturedAt ?? payment.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/orders/${payment.order.orderNumber}`} className="hf-link">
                        {payment.order.orderNumber}
                      </Link>
                      <p className="font-mono text-[11px] text-slate-400">{payment.providerPaymentId ?? payment.providerOrderId}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`hf-badge ${PAYMENT_ATTEMPT_STYLES[payment.status] ?? ""}`}>
                        {PAYMENT_ATTEMPT_LABELS[payment.status] ?? payment.status}
                      </span>
                      {payment.failureReason && <p className="mt-1 text-xs text-madder-700">{payment.failureReason}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {payment.provider === "TEST" ? "Test · " : payment.provider === "MANUAL" ? "Transfer · " : ""}
                      {payment.method ? (PAYMENT_METHOD_LABELS[payment.method] ?? payment.method) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">{formatPrice(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
