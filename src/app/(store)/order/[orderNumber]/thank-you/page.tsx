import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { formatDate, formatDateTime, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/utils";
import { getSettings } from "@/server/settings";
import AddressBlock from "@/components/orders/AddressBlock";
import OrderTotals from "@/components/orders/OrderTotals";
import OrderPaymentBox from "@/components/orders/OrderPaymentBox";
import PaymentConfirming from "@/components/payments/PaymentConfirming";
import { expireOrderIfDue } from "@/server/payments/expiry";

export const metadata: Metadata = {
  title: "Thank you for your order",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ confirming?: string }>;
}) {
  const { orderNumber } = await params;
  const { confirming } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/order/${orderNumber}/thank-you`)}`);

  // Scoped to the signed-in shopper: an order number alone never reveals an order.
  const found = await db.order.findFirst({ where: { orderNumber, userId: user.id }, select: { id: true } });
  if (!found) notFound();
  // A window that ended while nobody was looking: settle it now, not at the next scheduler run.
  await expireOrderIfDue(found.id).catch(() => false);
  const [order, settings, pendingTransfers] = await Promise.all([
    db.order.findUniqueOrThrow({ where: { id: found.id }, include: { items: true } }),
    getSettings(),
    db.payment.findMany({
      where: { orderId: found.id, provider: "MANUAL", status: "CREATED" },
      select: { amount: true, manualReference: true },
    }),
  ]);

  const awaitingPayment = order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_FAILED";
  const cancelled = order.status === "CANCELLED";
  const firstName = user.name.split(" ")[0];

  return (
    <div className="hf-container py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <span
            aria-hidden="true"
            className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl ${
              awaitingPayment || cancelled ? "bg-turmeric-100 text-turmeric-800" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {awaitingPayment || cancelled ? "!" : "✓"}
          </span>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-indigo-ink-950">
            {cancelled ? "This order was cancelled" : awaitingPayment ? `Almost done, ${firstName}` : `Thank you, ${firstName}`}
          </h1>
          <p className="mt-2 text-slate-600">
            {cancelled
              ? order.amountPaid > 0
                ? "Any payment taken for this order is being refunded to your original payment method."
                : order.cancelReason === "Payment not completed in time"
                  ? "The payment wasn't completed in time, so the items were released. Nothing was charged."
                  : "Nothing has been charged for the items that were cancelled."
              : awaitingPayment
                ? order.paymentMethod === "BANK_TRANSFER"
                  ? "Your order is reserved. Send the bank transfer below and tell us the UTR — we confirm the order once the money arrives."
                  : order.paymentDueBy
                    ? `We're holding your items until ${formatDateTime(order.paymentDueBy)}. Complete the payment to confirm the order.`
                    : "Complete the payment to confirm the order."
                : order.paymentMethod === "CREDIT"
                  ? `Your order is confirmed on credit${order.balanceDueAt ? ` — please pay by ${formatDate(order.balanceDueAt)}` : ""}. ${settings.shipping.dispatchText.replace(/\.$/, "")}.`
                  : `Your order is confirmed. ${settings.shipping.dispatchText.replace(/\.$/, "")}.`}
          </p>
        </div>

        {awaitingPayment && confirming && (
          <div className="mt-6">
            <PaymentConfirming orderNumber={order.orderNumber} />
          </div>
        )}
        {order.status === "PAYMENT_FAILED" && !confirming && (
          <p className="mt-6 rounded-lg bg-madder-50 px-4 py-3 text-sm text-madder-800">
            The last payment attempt didn&apos;t go through. No money was taken — you can try again.
          </p>
        )}
        {!confirming && (
          <div className="mt-6">
            <OrderPaymentBox order={order} bank={settings.wholesale} pendingTransfers={pendingTransfers} />
          </div>
        )}

        <div className="hf-card mt-8 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cotton-300 bg-cotton-100 px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Order number</p>
              <p className="font-display text-lg font-bold text-indigo-ink-950">{order.orderNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-500">Placed</p>
              <p className="font-semibold text-indigo-ink-900">{formatDateTime(order.placedAt)}</p>
            </div>
          </div>

          <ul className="divide-y divide-cotton-200 px-5">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-indigo-ink-900">{item.title}</p>
                  {item.variantLabel && <p className="text-xs text-slate-500">{item.variantLabel}</p>}
                  <p className="text-xs text-slate-500">
                    Qty {item.quantity} · {formatPrice(item.unitPrice)}
                    {order.pricesIncludeTax ? "" : " + GST"} each
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-indigo-ink-950">{formatPrice(item.lineSubtotal)}</p>
              </li>
            ))}
          </ul>

          <div className="border-t border-cotton-300 px-5 py-4">
            <OrderTotals order={order} />
          </div>

          <div className="grid gap-5 border-t border-cotton-300 px-5 py-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Delivering to</p>
              <AddressBlock value={order.shippingAddress} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Payment</p>
              <p className="mt-1 font-medium text-slate-700">{PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
              <p className="text-xs text-slate-500">{PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={`/account/orders/${order.orderNumber}`} className="hf-btn hf-btn-primary">
            View and track this order
          </Link>
          <Link href="/search" className="hf-btn hf-btn-outline">
            Continue shopping
          </Link>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Need help with this order?{" "}
          <Link href="/account/support" className="hf-link">
            Contact us
          </Link>
          {settings["store.profile"].email ? ` or email ${settings["store.profile"].email}` : ""}.
        </p>
      </div>
    </div>
  );
}
