import { formatPrice } from "@/lib/money";

export type OrderTotalsData = {
  pricesIncludeTax: boolean;
  itemsSubtotal: number;
  discountTotal: number;
  couponCode: string | null;
  shippingFee: number;
  codFee: number;
  giftWrapFee: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff: number;
  grandTotal: number;
  amountPaid?: number;
  amountRefunded?: number;
};

/** The money part of an order, as shown to customers and staff. */
export default function OrderTotals({ order, className }: { order: OrderTotalsData; className?: string }) {
  const gst = order.cgstTotal + order.sgstTotal + order.igstTotal;
  return (
    <dl className={className ?? "space-y-2 text-sm"}>
      <Row label={order.pricesIncludeTax ? "Items" : "Items (before GST)"} value={formatPrice(order.itemsSubtotal)} />
      {order.discountTotal > 0 && (
        <Row
          label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`}
          value={`− ${formatPrice(order.discountTotal)}`}
        />
      )}
      <Row label="Shipping" value={order.shippingFee === 0 ? "Free" : formatPrice(order.shippingFee)} />
      {order.codFee > 0 && <Row label="Cash on delivery fee" value={formatPrice(order.codFee)} />}
      {order.giftWrapFee > 0 && <Row label="Gift wrap" value={formatPrice(order.giftWrapFee)} />}
      {order.igstTotal > 0 ? (
        <Row label={order.pricesIncludeTax ? "IGST (included)" : "IGST"} value={formatPrice(order.igstTotal)} muted={order.pricesIncludeTax} />
      ) : (
        gst > 0 && (
          <>
            <Row label={order.pricesIncludeTax ? "CGST (included)" : "CGST"} value={formatPrice(order.cgstTotal)} muted={order.pricesIncludeTax} />
            <Row label={order.pricesIncludeTax ? "SGST (included)" : "SGST"} value={formatPrice(order.sgstTotal)} muted={order.pricesIncludeTax} />
          </>
        )
      )}
      {order.roundOff !== 0 && <Row label="Round off" value={formatPrice(order.roundOff)} />}
      <div className="flex justify-between border-t border-cotton-300 pt-2.5 font-display text-base font-bold text-indigo-ink-950">
        <dt>Total</dt>
        <dd>{formatPrice(order.grandTotal)}</dd>
      </div>
      {order.amountPaid != null && order.amountPaid > 0 && <Row label="Paid" value={formatPrice(order.amountPaid)} />}
      {order.amountRefunded != null && order.amountRefunded > 0 && (
        <Row label="Refunded" value={formatPrice(order.amountRefunded)} />
      )}
    </dl>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={muted ? "text-slate-400" : "text-slate-600"}>{label}</dt>
      <dd className={muted ? "text-slate-400" : "font-medium text-indigo-ink-900"}>{value}</dd>
    </div>
  );
}
