import { formatPrice } from "@/lib/money";

type Bank = { bankAccountName: string; bankAccountNumber: string; bankIfsc: string; bankName: string; upiId: string };

/** Where to send a bank transfer (Settings → Wholesale). */
export default function BankDetails({ bank, amount, reference }: { bank: Bank; amount?: number; reference?: string }) {
  if (!bank.bankAccountNumber || !bank.bankIfsc) {
    return (
      <p className="rounded-lg bg-cotton-100 p-3 text-sm text-slate-600">
        Our bank details will be shared with you by phone or WhatsApp. Please contact us before sending money.
      </p>
    );
  }
  const rows: [string, string][] = [
    ["Account name", bank.bankAccountName],
    ["Account number", bank.bankAccountNumber],
    ["IFSC", bank.bankIfsc],
    ["Bank", bank.bankName],
    ...(bank.upiId ? ([["UPI ID", bank.upiId]] as [string, string][]) : []),
    ...(amount != null ? ([["Amount", formatPrice(amount)]] as [string, string][]) : []),
    ...(reference ? ([["Payment note / remarks", reference]] as [string, string][]) : []),
  ].filter(([, value]) => value) as [string, string][];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-cotton-300 bg-white p-4 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-slate-500">{label}</dt>
          <dd className="select-all font-semibold text-indigo-ink-950">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
