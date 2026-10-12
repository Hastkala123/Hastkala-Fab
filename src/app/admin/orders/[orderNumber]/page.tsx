import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { formatPrice, formatRate } from "@/lib/money";
import { formatIndianMobile } from "@/lib/phone";
import { GST_STATE_CODES } from "@/lib/gstin";
import {
  formatDateTime,
  ORDER_STATUS_LABELS,
  PAYMENT_ATTEMPT_LABELS,
  PAYMENT_ATTEMPT_STYLES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  REFUND_STAFF_LABELS,
  STATUS_STYLES,
} from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/page-guard";
import { canTransitionOrder, ORDER_TRANSITIONS } from "@/server/orders/transitions";
import AddressBlock from "@/components/orders/AddressBlock";
import OrderTotals from "@/components/orders/OrderTotals";
import PaymentActionButton from "@/components/admin/PaymentActionButton";
import TransferReview from "@/components/admin/TransferReview";
import OrderStatusPanel from "./OrderStatusPanel";

export const metadata: Metadata = { title: "Order Details" };
export const dynamic = "force-dynamic";

const SHIPPING_STATUSES = new Set(["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RTO_IN_TRANSIT", "RTO_DELIVERED"]);

export default async function AdminOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const staff = await requireStaffPage("orders.view");
  const { orderNumber } = await params;

  const order = await db.order.findUnique({
    where: { orderNumber },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, customerType: true } },
      items: true,
      statusHistory: { orderBy: { createdAt: "desc" } },
      couponRedemption: { select: { releasedAt: true } },
      payments: { orderBy: { createdAt: "asc" } },
      refunds: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const actorIds = [...new Set(order.statusHistory.map((h) => h.actorId).filter((id): id is string => Boolean(id)))];
  const actors = await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  const actorName = (id: string | null) => actors.find((a) => a.id === id)?.name ?? null;

  // Moves this staff member may make from here (the server checks again).
  const allowed = Object.values(ORDER_TRANSITIONS[order.status])
    .map((rule) => rule.to)
    .filter((to) => canTransitionOrder(order.status, to, "STAFF"))
    .filter((to) => can(staff, "orders.manage") || (SHIPPING_STATUSES.has(to) && can(staff, "shipping.manage")));

  const canPayments = can(staff, "payments.verify") || can(staff, "orders.manage");

  return (
    <div>
      <Link href="/admin/orders" className="hf-link text-sm font-semibold">
        ← Orders
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Placed {formatDateTime(order.placedAt)}
            {order.customerType === "WHOLESALE" && " · wholesale order"}
            {order.channel !== "WEB" && ` · ${order.channel.toLowerCase()} order`}
          </p>
        </div>
        <span className={`hf-badge ${STATUS_STYLES[order.status] ?? ""}`}>
          {ORDER_STATUS_LABELS[order.status] ?? order.status}
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
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                    ) : (
                      <div className="h-full w-full bg-cotton-200" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    {item.productId ? (
                      <Link href={`/admin/products/${item.productId}`} className="font-medium text-indigo-ink-900 hover:underline">
                        {item.title}
                      </Link>
                    ) : (
                      <p className="font-medium text-indigo-ink-900">
                        {item.title} <span className="text-xs text-slate-400">(product removed)</span>
                      </p>
                    )}
                    {item.variantLabel && <p className="text-xs text-slate-500">{item.variantLabel}</p>}
                    <p className="text-xs text-slate-400">
                      SKU {item.sku} · HSN {item.hsnCode || "—"} · GST {formatRate(item.taxRateBps)} · Qty {item.quantity}
                      {item.quantityCancelled > 0 && ` · ${item.quantityCancelled} cancelled`}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold text-indigo-ink-950">{formatPrice(item.lineTotal)}</p>
                    <p className="text-xs text-slate-400">
                      {formatPrice(item.unitPrice)}
                      {order.pricesIncludeTax ? "" : " + GST"} each
                    </p>
                    {item.discountAllocated > 0 && (
                      <p className="text-xs text-emerald-700">− {formatPrice(item.discountAllocated)} discount</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-cotton-300 bg-cotton-50 px-5 py-4">
              <OrderTotals order={order} />
              <p className="mt-2 text-xs text-slate-500">
                Taxable value {formatPrice(order.taxableValue)} ·{" "}
                {order.taxType === "INTRA_STATE" ? "CGST + SGST" : "IGST"} · place of supply{" "}
                {GST_STATE_CODES[order.placeOfSupplyStateCode] ?? order.placeOfSupplyStateCode}
              </p>
            </div>
          </section>

          {(order.customerNote || order.giftMessage) && (
            <section className="hf-card p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">From the customer</h2>
              {order.customerNote && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{order.customerNote}</p>}
              {order.giftMessage && <p className="mt-2 text-sm text-slate-700">Gift message: {order.giftMessage}</p>}
            </section>
          )}

          <section className="hf-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Timeline</h2>
            <ol className="mt-4 space-y-3">
              {order.statusHistory.map((event) => (
                <li key={event.id} className="flex gap-3 text-sm">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${event.isCustomerVisible ? "bg-indigo-ink-600" : "bg-turmeric-500"}`}
                  />
                  <div>
                    <p className="font-medium text-indigo-ink-900">
                      {event.fromStatus === event.toStatus ? "Note" : (ORDER_STATUS_LABELS[event.toStatus] ?? event.toStatus)}
                      {!event.isCustomerVisible && <span className="ml-2 text-xs font-normal text-turmeric-700">staff only</span>}
                    </p>
                    {event.note && <p className="text-xs text-slate-600">{event.note}</p>}
                    <p className="text-xs text-slate-400">
                      {formatDateTime(event.createdAt)} · {event.actorType.toLowerCase()}
                      {actorName(event.actorId) ? ` (${actorName(event.actorId)})` : ""}
                    </p>
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
            allowed={allowed}
            canNote={can(staff, "orders.view")}
          />

          <section className="hf-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Customer</h2>
            <div className="mt-3 text-sm">
              <p className="font-semibold text-indigo-ink-900">{order.user.name}</p>
              {order.contactEmail && <p className="text-slate-600">{order.contactEmail}</p>}
              <p className="text-slate-600">{formatIndianMobile(order.contactPhone)}</p>
              {order.buyerBusinessName && <p className="mt-1 text-slate-600">{order.buyerBusinessName}</p>}
              {order.buyerGstin && <p className="font-mono text-xs text-slate-500">GSTIN {order.buyerGstin}</p>}
            </div>
            {can(staff, "customers.view") && (
              <Link href={`/admin/customers/${order.user.id}`} className="hf-link mt-3 inline-block text-sm font-semibold">
                View customer →
              </Link>
            )}
          </section>

          <section className="hf-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Deliver to</h2>
            <div className="mt-2 text-sm leading-relaxed">
              <AddressBlock value={order.shippingAddress} />
            </div>
          </section>

          <section className="hf-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Payment</h2>
            <div className="mt-3 text-sm">
              <p className="font-medium text-indigo-ink-900">{PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
              <p className={`font-semibold ${order.paymentStatus === "PAID" ? "text-emerald-700" : order.paymentStatus === "FAILED" ? "text-madder-600" : "text-slate-500"}`}>
                {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
              </p>
              {order.paymentDueBy && order.status === "PENDING_PAYMENT" && (
                <p className="mt-1 text-xs text-slate-500">Payment window ends {formatDateTime(order.paymentDueBy)}</p>
              )}
              {order.couponCode && (
                <p className="mt-2 text-xs text-slate-500">
                  Coupon {order.couponCode}
                  {order.couponRedemption?.releasedAt ? " (released on cancellation)" : ""}
                </p>
              )}
              {order.paymentTerms !== "PREPAID" && (
                <p className="mt-1 text-xs text-slate-500">
                  Terms: {order.paymentTerms === "CREDIT" ? "credit" : "advance + balance"}
                  {order.advanceAmount > 0 ? ` · advance ${formatPrice(order.advanceAmount)}` : ""}
                  {order.balanceDueAt ? ` · balance due ${formatDateTime(order.balanceDueAt)}` : ""}
                </p>
              )}
              {order.paymentMethod !== "COD" &&
                order.status !== "CANCELLED" &&
                order.amountPaid - order.amountRefunded < order.grandTotal &&
                !["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(order.status) && (
                  <p className="mt-2 rounded bg-madder-50 px-2.5 py-1.5 text-xs font-semibold text-madder-800">
                    Balance due: {formatPrice(order.grandTotal - (order.amountPaid - order.amountRefunded))} — collect before dispatch
                    {order.paymentMethod === "CREDIT" ? " (or by the credit due date)" : ""}
                  </p>
                )}
              {(order.amountPaid > 0 || order.amountRefunded > 0) && (
                <dl className="mt-3 grid grid-cols-2 gap-1 text-xs">
                  <dt className="text-slate-500">Received</dt>
                  <dd className="text-right font-semibold text-indigo-ink-900">{formatPrice(order.amountPaid)}</dd>
                  <dt className="text-slate-500">Refunded</dt>
                  <dd className="text-right font-semibold text-indigo-ink-900">{formatPrice(order.amountRefunded)}</dd>
                </dl>
              )}
            </div>
          </section>

          {(order.payments.length > 0 || order.refunds.length > 0) && (
            <section className="hf-card p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Payment attempts</h2>
                {canPayments && order.payments.some((p) => p.providerOrderId) && (
                  <PaymentActionButton body={{ action: "sync", orderId: order.id }} label="Check with gateway" />
                )}
              </div>
              <ul className="mt-3 space-y-3 text-xs">
                {order.payments.map((payment) => (
                  <li key={payment.id} className="rounded-lg border border-cotton-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`hf-badge ${PAYMENT_ATTEMPT_STYLES[payment.status] ?? ""}`}>
                        {PAYMENT_ATTEMPT_LABELS[payment.status] ?? payment.status}
                      </span>
                      <span className="font-semibold text-indigo-ink-900">{formatPrice(payment.amount)}</span>
                    </div>
                    <p className="mt-1.5 text-slate-500">
                      {payment.provider === "TEST" ? "Test gateway" : payment.provider === "MANUAL" ? "Bank transfer" : payment.provider}
                      {payment.method ? ` · ${PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}` : ""} ·{" "}
                      {formatDateTime(payment.capturedAt ?? payment.createdAt)}
                    </p>
                    {payment.providerPaymentId && <p className="break-all font-mono text-[11px] text-slate-400">{payment.providerPaymentId}</p>}
                    {payment.manualReference && <p className="font-mono text-[11px] text-slate-500">UTR {payment.manualReference}</p>}
                    {payment.provider === "MANUAL" && payment.status === "CREATED" && can(staff, "payments.verify") && (
                      <TransferReview paymentId={payment.id} amount={payment.amount} reference={payment.manualReference} />
                    )}
                    {payment.failureReason && <p className="mt-1 text-madder-700">{payment.failureReason}</p>}
                    {payment.amountRefunded > 0 && (
                      <p className="mt-1 text-slate-500">Refunded {formatPrice(payment.amountRefunded)}</p>
                    )}
                    {payment.attentionReason && (
                      <div className="mt-2 rounded bg-turmeric-50 p-2 text-turmeric-900">
                        <p className="font-semibold">Needs attention</p>
                        <p>{payment.attentionReason}</p>
                        {can(staff, "payments.verify") && (
                          <PaymentActionButton
                            body={{ action: "resolve", paymentId: payment.id }}
                            label="Mark resolved"
                            className="hf-link mt-1 text-xs font-semibold"
                          />
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {order.refunds.length > 0 && (
                <>
                  <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">Refunds</h3>
                  <ul className="mt-2 space-y-2 text-xs">
                    {order.refunds.map((refund) => (
                      <li key={refund.id} className="rounded-lg border border-cotton-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-indigo-ink-900">{refund.refundNumber}</span>
                          <span className="font-semibold text-indigo-ink-900">{formatPrice(refund.amount)}</span>
                        </div>
                        <p className="mt-1 text-slate-500">
                          {REFUND_STAFF_LABELS[refund.status]} · {refund.reason}
                        </p>
                        {refund.providerRefundId && <p className="break-all font-mono text-[11px] text-slate-400">{refund.providerRefundId}</p>}
                        {refund.failureReason && <p className="mt-1 text-madder-700">{refund.failureReason}</p>}
                        {refund.status === "FAILED" && can(staff, "refunds.issue") && (
                          <PaymentActionButton
                            body={{ action: "retry-refund", refundId: refund.id }}
                            label="Retry refund"
                            confirmText={`Send refund ${refund.refundNumber} of ${formatPrice(refund.amount)} to the gateway again?`}
                            className="hf-btn hf-btn-outline mt-2 px-3 py-1.5 text-xs"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
