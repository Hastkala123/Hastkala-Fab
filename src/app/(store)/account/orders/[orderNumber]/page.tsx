import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserPage } from "@/server/auth/page-guard";
import { formatPrice } from "@/lib/money";
import { productPath } from "@/lib/routes";
import {
  formatDate,
  formatDateTime,
  ORDER_FLOW,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  REFUND_STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/utils";
import { CUSTOMER_CANCELLABLE } from "@/server/orders/transitions";
import { getCustomerOrder } from "@/server/orders/service";
import { getSettings } from "@/server/settings";
import AddressBlock from "@/components/orders/AddressBlock";
import OrderTotals from "@/components/orders/OrderTotals";
import CancelOrderButton from "./CancelOrderButton";
import PayNowButton from "@/components/payments/PayNowButton";
import { expireOrderIfDue } from "@/server/payments/expiry";

export const metadata: Metadata = {
  title: "Order Details",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const OFF_TRACK = new Set(["CANCELLED", "RTO_IN_TRANSIT", "RTO_DELIVERED", "PENDING_PAYMENT", "PAYMENT_FAILED"]);

export default async function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const user = await requireUserPage();
  const found = await getCustomerOrder(user.id, orderNumber);
  if (!found) notFound();
  // A payment window that ended while nobody was looking is settled before showing the order.
  await expireOrderIfDue(found.id).catch(() => false);
  const [order, settings] = await Promise.all([getCustomerOrder(user.id, orderNumber), getSettings()]);
  if (!order) notFound();

  const currentStep = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]);
  const canCancel = CUSTOMER_CANCELLABLE.includes(order.status);
  const returnDays = settings.returns.windowDays;

  return (
    <div>
      <Link href="/account/orders" className="hf-link text-sm font-semibold">
        ← All orders
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-slate-600">Placed {formatDateTime(order.placedAt)}</p>
        </div>
        <span className={`hf-badge ${STATUS_STYLES[order.status] ?? ""}`}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
      </div>

      {(order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_FAILED") && (
        <div className="mt-6 space-y-3 rounded-card border border-turmeric-200 bg-turmeric-50 p-4">
          <p className="text-sm text-turmeric-900">
            {order.status === "PAYMENT_FAILED"
              ? "The last payment attempt didn't go through, and no money was taken. "
              : "We're waiting for your payment. "}
            {order.paymentDueBy && `Your items are held until ${formatDateTime(order.paymentDueBy)}.`}
          </p>
          {order.paymentDueBy && (
            <PayNowButton
              orderNumber={order.orderNumber}
              amount={order.grandTotal - order.amountPaid}
              dueBy={order.paymentDueBy.toISOString()}
            />
          )}
        </div>
      )}

      {!OFF_TRACK.has(order.status) && (
        <div className="hf-card mt-6 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Tracking</h2>
          <ol className="mt-5 flex items-start justify-between gap-1">
            {ORDER_FLOW.map((step, index) => {
              const done = index <= currentStep;
              return (
                <li key={step} className="relative flex flex-1 flex-col items-center">
                  {index > 0 && (
                    <span
                      aria-hidden="true"
                      className={`absolute right-1/2 top-3.5 h-0.5 w-full ${index <= currentStep ? "bg-indigo-ink-700" : "bg-cotton-300"}`}
                    />
                  )}
                  <span
                    className={`relative z-10 grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                      done ? "bg-indigo-ink-800 text-white" : "bg-cotton-200 text-slate-400"
                    }`}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  <span className={`mt-2 text-center text-[11px] leading-tight ${done ? "font-semibold text-indigo-ink-900" : "text-slate-400"}`}>
                    {ORDER_STATUS_LABELS[step]}
                    {done && index === currentStep ? <span className="sr-only"> (current)</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <section className="hf-card mt-6 overflow-hidden">
        <h2 className="border-b border-cotton-200 bg-cotton-100 px-5 py-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Items ({order.items.length})
        </h2>
        <ul className="divide-y divide-cotton-200">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4 p-4">
              <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-lg bg-cotton-100">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.title} fill sizes="64px" className="object-cover" />
                ) : (
                  <div className="h-full w-full bg-cotton-200" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-indigo-ink-900">
                  {item.product ? (
                    <Link href={productPath(item.product.slug)} className="hover:underline">
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                </p>
                {item.variantLabel && <p className="text-xs text-slate-500">{item.variantLabel}</p>}
                <p className="text-xs text-slate-500">
                  SKU {item.sku} · Qty {item.quantity}
                  {item.quantityCancelled > 0 && ` · ${item.quantityCancelled} cancelled`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-indigo-ink-950">{formatPrice(item.lineSubtotal)}</p>
                <p className="text-xs text-slate-400">
                  {formatPrice(item.unitPrice)}
                  {order.pricesIncludeTax ? "" : " + GST"} each
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="hf-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Payment summary</h2>
          <OrderTotals order={order} className="mt-4 space-y-2 text-sm" />
          <p className="mt-3 text-xs text-slate-500">
            {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod} ·{" "}
            {(PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus).toLowerCase()}
          </p>
          {order.refunds.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-cotton-200 pt-3 text-xs">
              {order.refunds.map((refund) => (
                <li key={refund.refundNumber} className="flex justify-between gap-3">
                  <span className="text-slate-600">
                    Refund {refund.refundNumber} · {REFUND_STATUS_LABELS[refund.status] ?? refund.status}
                  </span>
                  <span className="font-semibold text-indigo-ink-900">{formatPrice(refund.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="hf-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Delivery address</h2>
          <div className="mt-3 text-sm leading-relaxed">
            <AddressBlock value={order.shippingAddress} />
          </div>
        </section>
      </div>

      <section className="hf-card mt-6 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Order history</h2>
        <ol className="mt-4 space-y-3">
          {order.statusHistory.map((event) => (
            <li key={event.id} className="flex gap-3 text-sm">
              <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-ink-600" />
              <div>
                <p className="font-medium text-indigo-ink-900">{ORDER_STATUS_LABELS[event.toStatus] ?? event.toStatus}</p>
                {event.note && <p className="text-xs text-slate-500">{event.note}</p>}
                <time dateTime={event.createdAt.toISOString()} className="text-xs text-slate-400">
                  {formatDateTime(event.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        {canCancel && <CancelOrderButton orderNumber={order.orderNumber} />}
        <Link href={`/account/support?order=${encodeURIComponent(order.orderNumber)}`} className="hf-btn hf-btn-outline">
          Need help with this order?
        </Link>
      </div>

      {order.status === "DELIVERED" && returnDays > 0 && order.deliveredAt && (
        <p className="mt-4 rounded-lg bg-cotton-100 px-4 py-3 text-xs text-slate-600">
          Returns are accepted until {formatDate(new Date(order.deliveredAt.getTime() + returnDays * 86_400_000))}.{" "}
          {settings.returns.conditionsText}
        </p>
      )}
    </div>
  );
}
