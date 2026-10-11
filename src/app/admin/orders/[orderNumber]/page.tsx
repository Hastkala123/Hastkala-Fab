import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { formatDateTime, STATUS_LABELS, STATUS_STYLES } from "@/lib/utils";
import OrderStatusPanel from "./OrderStatusPanel";

export const metadata: Metadata = { title: "Order Details" };
export const dynamic = "force-dynamic";

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  await requireAdmin();
  const { orderNumber } = await params;

  const order = await db.order.findUnique({
    where: { orderNumber },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      items: true,
      events: { orderBy: { createdAt: "desc" } },
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

  return (
    <div>
      <Link href="/admin/orders" className="hf-link text-sm font-semibold">
        ← Orders
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Placed {formatDateTime(order.placedAt)}
            {order.orderType === "WHOLESALE" && " · wholesale order"}
          </p>
        </div>
        <span className={`hf-badge ${STATUS_STYLES[order.status] ?? ""}`}>
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="hf-card overflow-hidden">
            <h2 className="border-b border-cotton-200 bg-cotton-100 px-5 py-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Items ({order.items.length})
            </h2>
            <ul className="divide-y divide-cotton-200">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 p-4">
                  <div className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded bg-cotton-100">
                    {item.imageSnapshot ? (
                      <Image
                        src={item.imageSnapshot}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-cotton-200" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    {item.productId ? (
                      <Link
                        href={`/admin/products/${item.productId}`}
                        className="font-medium text-indigo-ink-900 hover:underline"
                      >
                        {item.titleSnapshot}
                      </Link>
                    ) : (
                      <p className="font-medium text-indigo-ink-900">
                        {item.titleSnapshot}{" "}
                        <span className="text-xs text-slate-400">(deleted)</span>
                      </p>
                    )}
                    {item.variantLabel && (
                      <p className="text-xs text-slate-500">{item.variantLabel}</p>
                    )}
                    <p className="text-xs text-slate-400">
                      SKU {item.skuSnapshot} · Qty {item.quantity}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold text-indigo-ink-950">
                      {formatPrice(item.lineTotal)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatPrice(item.unitPrice)} each
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="space-y-2 border-t border-cotton-300 bg-cotton-50 px-5 py-4 text-sm">
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
          </section>

          {order.customerNote && (
            <section className="hf-card p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Customer note
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {order.customerNote}
              </p>
            </section>
          )}

          <section className="hf-card p-5">
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
                    {event.note && (
                      <p className="text-xs text-slate-500">{event.note}</p>
                    )}
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
        </div>

        <div className="space-y-6">
          <OrderStatusPanel
            orderId={order.id}
            currentStatus={order.status}
            trackingNumber={order.trackingNumber ?? ""}
            courierName={order.courierName ?? ""}
          />

          <section className="hf-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Customer
            </h2>
            <div className="mt-3 text-sm">
              <p className="font-semibold text-indigo-ink-900">{order.user.name}</p>
              <p className="text-slate-600">{order.user.email}</p>
              {order.user.phone && <p className="text-slate-600">{order.user.phone}</p>}
              <span className="hf-badge mt-2 text-slate-600">{order.user.role}</span>
            </div>
            <Link
              href={`/admin/customers/${order.user.id}`}
              className="hf-link mt-3 inline-block text-sm font-semibold"
            >
              View customer →
            </Link>
          </section>

          <section className="hf-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Shipping address
            </h2>
            <address className="mt-3 text-sm not-italic leading-relaxed text-slate-700">
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

          <section className="hf-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Payment
            </h2>
            <div className="mt-3 text-sm">
              <p className="font-medium text-indigo-ink-900">{order.paymentMethod}</p>
              <p
                className={`font-semibold ${
                  order.paymentStatus === "PAID"
                    ? "text-emerald-700"
                    : order.paymentStatus === "FAILED"
                      ? "text-madder-600"
                      : "text-slate-500"
                }`}
              >
                {order.paymentStatus}
              </p>
              {order.paymentRef && (
                <p className="mt-1 font-mono text-xs text-slate-400">
                  {order.paymentRef}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
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
