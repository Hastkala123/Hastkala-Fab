import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Order Confirmed",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OrderConfirmedPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Scoped to the signed-in user: knowing an order number is not enough to
  // view someone else's order and the personal data it contains.
  const order = await db.order.findFirst({
    where: { orderNumber, userId: user.id },
    include: { items: true },
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

  const estimatedDelivery = new Date(order.placedAt);
  estimatedDelivery.setDate(estimatedDelivery.getDate() + 6);

  return (
    <div className="hf-container py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-700"
          >
            ✓
          </span>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-indigo-ink-950">
            Thank you, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-2 text-slate-600">
            Your order is confirmed. We have emailed the details and a GST invoice
            to {user.email}.
          </p>
        </div>

        <div className="hf-card mt-8 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cotton-300 bg-cotton-100 px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Order number
              </p>
              <p className="font-display text-lg font-bold text-indigo-ink-950">
                {order.orderNumber}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Estimated delivery
              </p>
              <p className="font-semibold text-indigo-ink-900">
                {formatDate(estimatedDelivery)}
              </p>
            </div>
          </div>

          <ul className="divide-y divide-cotton-200 px-5">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-indigo-ink-900">
                    {item.titleSnapshot}
                  </p>
                  {item.variantLabel && (
                    <p className="text-xs text-slate-500">{item.variantLabel}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    Qty {item.quantity} · {formatPrice(item.unitPrice)} each
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-indigo-ink-950">
                  {formatPrice(item.lineTotal)}
                </p>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 border-t border-cotton-300 px-5 py-4 text-sm">
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

          <div className="grid gap-5 border-t border-cotton-300 px-5 py-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Delivering to
              </p>
              <address className="mt-1 not-italic text-slate-700">
                {shipping.fullName}
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
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Payment</p>
              <p className="mt-1 font-medium text-slate-700">
                {order.paymentMethod === "COD"
                  ? "Cash on Delivery"
                  : order.paymentMethod}
              </p>
              <p className="text-xs text-slate-500">
                Status: {order.paymentStatus.toLowerCase()}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={`/account/orders`} className="hf-btn hf-btn-primary">
            Track this order
          </Link>
          <Link href="/products" className="hf-btn hf-btn-outline">
            Continue shopping
          </Link>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Need help with this order? Visit our{" "}
          <Link href="/help" className="hf-link">
            Help Centre
          </Link>{" "}
          or email support@hastkalafab.com.
        </p>
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
