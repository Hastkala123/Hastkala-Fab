import { formatPrice } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";
import { confirmThreshold } from "@/server/payments/status";
import BankDetails from "@/components/wholesale/BankDetails";
import BankTransferForm from "@/components/wholesale/BankTransferForm";
import PayNowButton from "@/components/payments/PayNowButton";

type Order = {
  orderNumber: string;
  status: string;
  paymentMethod: string;
  grandTotal: number;
  amountPaid: number;
  amountRefunded: number;
  advanceAmount: number;
  paymentDueBy: Date | null;
  balanceDueAt: Date | null;
};

type Bank = {
  bankTransferEnabled: boolean;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
  upiId: string;
};

/**
 * What the shopper can do about paying this order: pay online (the full
 * amount, the advance, or the balance), or send a bank transfer and tell us
 * the UTR. Nothing is shown when nothing is due.
 */
export default function OrderPaymentBox({
  order,
  bank,
  pendingTransfers,
}: {
  order: Order;
  bank: Bank;
  pendingTransfers: { amount: number; manualReference: string | null }[];
}) {
  const kept = order.amountPaid - order.amountRefunded;
  const awaiting = order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_FAILED";
  const closed = ["CANCELLED", "RTO_IN_TRANSIT", "RTO_DELIVERED"].includes(order.status);
  if (order.paymentMethod === "COD" || closed) return null;

  const balance = order.grandTotal - kept;
  const dueNow = awaiting ? confirmThreshold(order) - kept : balance;
  if (dueNow <= 0) return null;

  const bankTransfer = order.paymentMethod === "BANK_TRANSFER" || order.paymentMethod === "CREDIT" || order.advanceAmount > 0;
  const showBank = bank.bankTransferEnabled && bankTransfer;
  const pendingTotal = pendingTransfers.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-4 rounded-card border border-turmeric-200 bg-turmeric-50 p-4 sm:p-5">
      <div>
        <p className="font-semibold text-indigo-ink-950">
          {awaiting
            ? order.advanceAmount > 0 && dueNow < balance
              ? `Advance to pay: ${formatPrice(dueNow)}`
              : `To pay: ${formatPrice(dueNow)}`
            : `Balance due: ${formatPrice(balance)}`}
        </p>
        <p className="mt-0.5 text-sm text-slate-700">
          {awaiting
            ? order.paymentDueBy
              ? `We're holding your items until ${formatDateTime(order.paymentDueBy)}.`
              : "Pay to confirm your order."
            : order.paymentMethod === "CREDIT" && order.balanceDueAt
              ? `On credit — please pay by ${formatDate(order.balanceDueAt)}.`
              : "Please pay the balance before dispatch."}
          {awaiting && order.advanceAmount > 0 && dueNow < balance && ` The rest (${formatPrice(balance - dueNow)}) is due before dispatch.`}
        </p>
      </div>

      {pendingTotal > 0 && (
        <p className="rounded-lg bg-white px-3.5 py-2.5 text-sm text-indigo-ink-900">
          We&apos;re checking your bank transfer of {formatPrice(pendingTotal)}
          {pendingTransfers[0]?.manualReference ? ` (UTR ${pendingTransfers[0].manualReference})` : ""} — usually within one working day.
        </p>
      )}

      <div className="flex flex-wrap items-start gap-3">
        <PayNowButton
          orderNumber={order.orderNumber}
          amount={dueNow}
          dueBy={awaiting && order.paymentDueBy ? order.paymentDueBy.toISOString() : undefined}
          label={`Pay ${formatPrice(dueNow)} online`}
        />
        {showBank && <BankTransferForm orderNumber={order.orderNumber} balance={dueNow} />}
      </div>

      {showBank && (
        <div className="max-w-md">
          <p className="mb-2 text-sm font-semibold text-indigo-ink-900">Bank transfer details</p>
          <BankDetails bank={bank} amount={dueNow} reference={order.orderNumber} />
        </div>
      )}
    </div>
  );
}
