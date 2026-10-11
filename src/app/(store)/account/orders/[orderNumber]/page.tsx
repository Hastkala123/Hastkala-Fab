import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import {
  formatDate,
  formatDateTime,
  ORDER_FLOW,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/utils";
import CancelOrderButton from "./CancelOrderButton";

export const metadata: Metadata = {
  title: "Order Details",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const user = await requireUser();

  const order = await db.order.findFirst({
    where: { orderNumber, userId: user.id },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) notFound();

  const shipping = JSON.parse(order.shippingSnapshot) as {
    fullName: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
    phone: string;
  };

  const isTerminal = order.status === "CANCELLED" || order.status === "RETURNED";
  const currentStep = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]);
  const canCancel = order.status === "PENDING" || order.status === "CONFIRMED";

  return (
    <div>
      <Link href="/account/orders" className="hf-link text-sm font-semibold">
        ← All orders
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Placed {formatDate(order.placedAt)}
          </p>
        </div>
        <span className={`hf-badge ${STATUS_STYLES[order.status] ?? ""}`}>
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      {/* --------- Tracking stepper --------- */}
      {!isTerminal && (
        <div className="hf-card mt-6 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Tracking
          </h2>
          <ol className="mt-5 flex items-start justify-between gap-1">
            {ORDER_FLOW.map((step, index) => {
              const done = index <= currentStep;
              return (
                <li key={step} className="relative flex flex-1 flex-col items-center">
                  {index > 0 && (
                    <span
                      aria-hidden="true"
                      className={`absolute right-1/2 top-3.5 h-0.5 w-full ${
                        index <= currentStep ? "bg-indigo-ink-700" : "bg-cotton-300"
                      }`}
                    />
                  )}
                  <span
                    className={`relative z-10 grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                      done
                        ? "bg-indigo-ink-800 text-white"
                        : "bg-cotton-200 text-slate-400"
                    }`}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  <span
                    className={`mt-2 text-center text-[11px] leading-tight ${
                      done ? "font-semibold text-indigo-ink-900" : "text-slate-400"
                    }`}
                  >
                    {STATUS_LABELS[step]}
                  </span>
                </li>
              );
            })}
          </ol>

          {order.trackingNumber && (
            <div className="mt-5 rounded-lg bg-cotton-100 px-4 py-3 text-sm">
              <p className="font-semibold text-indigo-ink-900">
                {order.courierName ?? "Courier"}
              </p>
              <p className="text-slate-600">
                Tracking number: <strong>{order.trackingNumber}</strong>
              </p>
            </div>
          )}
        </div>
      )}

      {/* --------- Items --------- */}
      <section className="hf-card mt-6 overflow-hidden">
        <h2 className="border-b border-cotton-200 bg-cotton-100 px-5 py-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Items ({order.items.length})
        </h2>
        <ul className="divide-y divide-cotton-200">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4 p-4">
              <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-lg bg-cotton-100">
                {item.imageSnapshot ? (
                  <Image
                    src={item.imageSnapshot}
                    alt={item.titleSnapshot}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-cotton-200" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-indigo-ink-900">
                  {item.titleSnapshot}
                </p>
                {item.variantLabel && (
                  <p className="text-xs text-slate-500">{item.variantLabel}</p>
                )}
                <p className="text-xs text-slate-500">
                  SKU {item.skuSnapshot} · Qty {item.quantity}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-indigo-ink-950">
                  {formatPrice(item.lineTotal)}
                </p>
                <p className="text-xs text-slate-400">
                  {formatPrice(item.unitPrice)} each
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* --------- Summary + address --------- */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="hf-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Payment summary
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Subtotal" value={formatPrice(order.subtotal)} />
            {order.discount > 0 && (
              <Row
                label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`}
                value={`− ${formatPrice(order.discount)}`}
              />
            )}
            <Row
              label="Shipping"
              value={order.shippingFee === 0 ? "Free" : formatPrice(order.shippingFee)}
            />
            <Row label="GST" value={formatPrice(order.tax)} />
            <div className="flex justify-between border-t border-cotton-300 pt-2.5 font-display text-base font-bold text-indigo-ink-950">
              <dt>Total</dt>
              <dd>{formatPrice(order.total)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            {order.paymentMethod === "COD" ? "Cash on Delivery" : order.paymentMethod} ·
            payment {order.paymentStatus.toLowerCase()}
          </p>
        </section>

        <section className="hf-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Delivery address
          </h2>
          <address className="mt-4 text-sm not-italic leading-relaxed text-slate-700">
            <strong className="text-indigo-ink-900">{shipping.fullName}</strong>
            <br />
            {shipping.line1}
            {shipping.line2 && (
              <>
                <br />
                {shipping.line2}
              </>
            )}
            <br />
            {shipping.city}, {shipping.state} {shipping.pincode}
            <br />
            Phone: {shipping.phone}
          </address>
        </section>
      </div>

      {/* --------- Timeline --------- */}
      <section className="hf-card mt-6 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Order history
        </h2>
        <ol className="mt-4 space-y-3">
          {order.events.map((event) => (
            <li key={event.id} className="flex gap-3 text-sm">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-ink-600"
              />
              <div>
                <p className="font-medium text-indigo-ink-900">
                  {STATUS_LABELS[event.status] ?? event.status}
                </p>
                {event.note && <p className="text-xs text-slate-500">{event.note}</p>}
                <time
                  dateTime={event.createdAt.toISOString()}
                  className="text-xs text-slate-400"
                >
                  {formatDateTime(event.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        {canCancel && (
          <CancelOrderButton orderId={order.id} orderNumber={order.orderNumber} />
        )}
        <Link
          href={`/help?order=${encodeURIComponent(order.orderNumber)}`}
          className="hf-btn hf-btn-outline"
        >
          Need help with this order?
        </Link>
      </div>

      {order.status === "DELIVERED" && (
        <p className="mt-4 rounded-lg bg-cotton-100 px-4 py-3 text-xs text-slate-600">
          Returns are accepted within 7 days of delivery on unused items with tags
          intact. Raise a request through the Help Centre and we will arrange a
          reverse pickup.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-medium text-indigo-ink-900">{value}</dd>
    </div>
  );
}
