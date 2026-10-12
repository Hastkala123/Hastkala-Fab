"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { formatPrice } from "@/lib/money";
import { useToast } from "@/components/ui/Toast";

/** Staff: confirm a bank transfer is in the bank, or reject it with a reason the buyer sees. */
export default function TransferReview({ paymentId, amount, reference }: { paymentId: string; amount: number; reference: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function review(approve: boolean) {
    if (approve && !window.confirm(`Confirm ${formatPrice(amount)} (UTR ${reference ?? "—"}) has reached the bank account?`)) return;
    setPending(true);
    const result = await apiRequest("/api/admin/payments", {
      body: { action: "review-transfer", paymentId, approve, reason: approve ? null : reason },
    });
    setPending(false);
    if (!result.ok) {
      toast(result.fields?.reason ?? result.error, "error");
      return;
    }
    toast(approve ? "Transfer confirmed" : "Transfer rejected — the buyer has been told", "success");
    setRejecting(false);
    router.refresh();
  }

  if (rejecting) {
    return (
      <div className="mt-2 space-y-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. No transfer with this UTR has arrived"
          maxLength={300}
          aria-label="Reason"
          className="hf-input py-1.5 text-sm"
        />
        <div className="flex gap-2">
          <button type="button" disabled={pending || reason.trim().length < 5} onClick={() => review(false)} className="hf-btn hf-btn-accent px-3 py-1 text-xs">
            Reject transfer
          </button>
          <button type="button" onClick={() => setRejecting(false)} className="hf-btn hf-btn-outline px-3 py-1 text-xs">
            Cancel
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" disabled={pending} onClick={() => review(true)} className="hf-btn bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700">
        Money received
      </button>
      <button type="button" disabled={pending} onClick={() => setRejecting(true)} className="hf-btn hf-btn-outline px-3 py-1 text-xs">
        Not received…
      </button>
    </div>
  );
}
