"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { FormError } from "@/components/ui/Field";
import TextInput from "./TextInput";

/** "I've paid by bank transfer" — the UTR goes to our team to check against the bank. */
export default function BankTransferForm({ orderNumber, balance }: { orderNumber: string; balance: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(balance / 100));
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="hf-btn hf-btn-outline">
        I&apos;ve paid by bank transfer
      </button>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFields({});
    const result = await apiRequest("/api/wholesale/bank-transfer", { body: { orderNumber, amount, reference, paidOn } });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      setFields(result.fields ?? {});
      return;
    }
    toast("Thanks — we'll confirm your transfer once it reaches our account", "success");
    setOpen(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="w-full space-y-3 rounded-lg border border-cotton-300 bg-cotton-50 p-4" noValidate>
      <p className="text-sm font-semibold text-indigo-ink-900">Tell us about your transfer</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput label="Amount sent (₹)" type="number" value={amount} onChange={setAmount} error={fields.amount} required />
        <TextInput
          label="UTR / reference number"
          value={reference}
          onChange={(v) => setReference(v.toUpperCase())}
          error={fields.reference}
          required
          maxLength={30}
          hint="From your bank's confirmation"
        />
        <TextInput label="Date sent" type="date" value={paidOn} onChange={setPaidOn} error={fields.paidOn} />
      </div>
      <FormError message={error} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="hf-btn hf-btn-primary">
          {pending ? "Sending…" : "Send for confirmation"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="hf-btn hf-btn-outline">
          Cancel
        </button>
      </div>
    </form>
  );
}
