import type { Metadata } from "next";
import Link from "next/link";
import { isApprovedWholesale } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { formatDate, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, REFUND_STATUS_LABELS } from "@/lib/utils";
import { requireUserPage } from "@/server/auth/page-guard";
import { getSettings } from "@/server/settings";
import { buyerLedger } from "@/server/wholesale/ledger";
import BankDetails from "@/components/wholesale/BankDetails";
import BankTransferForm from "@/components/wholesale/BankTransferForm";
import PayNowButton from "@/components/payments/PayNowButton";

export const metadata: Metadata = { title: "Account statement", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The buyer's khata: balances due, payments, transfers and refunds. */
export default async function LedgerPage() {
  const user = await requireUserPage("/account/wholesale/ledger");
  const [ledger, settings] = await Promise.all([buyerLedger(user.id), getSettings()]);
  const { summary } = ledger;
  const due = ledger.rows.filter((r) => r.balance > 0 && !r.awaiting && r.status !== "CANCELLED");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950 sm:text-3xl">Account statement</h1>
        <p className="mt-1 text-sm text-slate-600">What you owe, what you&apos;ve paid, and every payment and refund.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Balance due" value={formatPrice(summary.outstanding)} accent={summary.outstanding > 0} />
        <Tile label="Overdue" value={formatPrice(summary.overdue)} accent={summary.overdue > 0} />
        <Tile label="Paid so far" value={formatPrice(summary.totalPaid)} />
        {summary.creditLimit != null ? (
          <Tile label="Credit available" value={formatPrice(summary.creditAvailable ?? 0)} detail={`of ${formatPrice(summary.creditLimit)}`} />
        ) : (
          <Tile label="Waiting for payment" value={formatPrice(summary.awaitingPayment)} detail="Orders not yet confirmed" />
        )}
      </div>

      {due.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">To pay</h2>
          <ul className="mt-3 space-y-3">
            {due.map((row) => (
              <li key={row.id} className={`hf-card p-4 ${row.overdue ? "border-madder-300" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/account/orders/${row.orderNumber}`} className="font-semibold text-indigo-ink-900 hover:underline">
                      {row.orderNumber}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {formatDate(row.placedAt)} · total {formatPrice(row.grandTotal)} · paid {formatPrice(row.paid)}
                    </p>
                    {row.dueAt && (
                      <p className={`mt-0.5 text-xs font-medium ${row.overdue ? "text-madder-700" : "text-slate-600"}`}>
                        {row.overdue ? "Overdue since" : "Due by"} {formatDate(row.dueAt)}
                      </p>
                    )}
                  </div>
                  <p className="font-display text-lg font-bold text-indigo-ink-950">{formatPrice(row.balance)}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-start gap-3">
                  <PayNowButton orderNumber={row.orderNumber} amount={row.balance} label={`Pay ${formatPrice(row.balance)} online`} />
                  {settings.wholesale.bankTransferEnabled && <BankTransferForm orderNumber={row.orderNumber} balance={row.balance} />}
                </div>
              </li>
            ))}
          </ul>
          {settings.wholesale.bankTransferEnabled && (
            <div className="mt-4 max-w-md">
              <p className="mb-2 text-sm font-semibold text-indigo-ink-900">Our bank details</p>
              <BankDetails bank={settings.wholesale} />
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="font-display text-lg font-bold text-indigo-ink-950">Orders</h2>
        {ledger.rows.length === 0 ? (
          <p className="hf-card mt-3 p-6 text-sm text-slate-500">
            No orders yet.{" "}
            {isApprovedWholesale(user) && (
              <Link href="/account/wholesale/quick-order" className="hf-link">
                Place a quick order
              </Link>
            )}
          </p>
        ) : (
          <div className="hf-card mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-cotton-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5 text-right">Paid</th>
                  <th className="px-4 py-2.5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cotton-200">
                {ledger.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/account/orders/${row.orderNumber}`} className="hf-link font-semibold">
                        {row.orderNumber}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {formatDate(row.placedAt)} · {PAYMENT_METHOD_LABELS[row.paymentMethod] ?? row.paymentMethod}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{ORDER_STATUS_LABELS[row.status] ?? row.status}</td>
                    <td className="px-4 py-2.5 text-right">{formatPrice(row.grandTotal)}</td>
                    <td className="px-4 py-2.5 text-right">{formatPrice(row.paid)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${row.overdue ? "text-madder-700" : "text-indigo-ink-950"}`}>
                      {formatPrice(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-indigo-ink-950">Payments</h2>
        {ledger.payments.length === 0 ? (
          <p className="hf-card mt-3 p-6 text-sm text-slate-500">No payments yet.</p>
        ) : (
          <ul className="hf-card mt-3 divide-y divide-cotton-200">
            {ledger.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-indigo-ink-900">
                    {p.method ? (PAYMENT_METHOD_LABELS[p.method] ?? p.method) : "Online"} · {p.order.orderNumber}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(p.capturedAt ?? p.createdAt)}
                    {p.manualReference ? ` · UTR ${p.manualReference}` : ""}
                  </p>
                  {p.provider === "MANUAL" && p.status === "CREATED" && <p className="text-xs font-medium text-turmeric-800">Being checked by our team</p>}
                  {p.provider === "MANUAL" && p.status === "FAILED" && <p className="text-xs font-medium text-madder-700">Not found: {p.failureReason}</p>}
                </div>
                <p className={`font-semibold ${p.status === "FAILED" ? "text-slate-400 line-through" : "text-indigo-ink-950"}`}>{formatPrice(p.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ledger.refunds.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">Refunds</h2>
          <ul className="hf-card mt-3 divide-y divide-cotton-200">
            {ledger.refunds.map((r) => (
              <li key={r.refundNumber} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-indigo-ink-900">
                    {r.refundNumber} · {r.order.orderNumber}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(r.createdAt)} · {REFUND_STATUS_LABELS[r.status] ?? r.status}
                  </p>
                </div>
                <p className="font-semibold text-indigo-ink-950">{formatPrice(r.amount)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value, detail, accent }: { label: string; value: string; detail?: string; accent?: boolean }) {
  return (
    <div className={`hf-card p-4 ${accent ? "border-madder-200 bg-madder-50" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-indigo-ink-950">{value}</p>
      {detail && <p className="text-xs text-slate-500">{detail}</p>}
    </div>
  );
}
