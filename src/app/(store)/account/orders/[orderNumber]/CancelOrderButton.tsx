"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

export default function CancelOrderButton({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function cancel() {
    setPending(true);
    const result = await apiRequest("/api/orders/cancel", {
      body: { orderId, reason },
    });
    setPending(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }

    toast(`Order ${orderNumber} cancelled`, "success");
    setConfirming(false);
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="hf-btn hf-btn-outline border-madder-300 text-madder-700 hover:bg-madder-50"
      >
        Cancel this order
      </button>
    );
  }

  return (
    <div className="hf-card w-full border-madder-200 bg-madder-50 p-4">
      <p className="text-sm font-semibold text-madder-900">
        Cancel order {orderNumber}?
      </p>
      <p className="mt-1 text-xs text-madder-700">
        This cannot be undone. Any payment already made will be refunded to the
        original method within 5–7 working days.
      </p>

      <label htmlFor="cancel-reason" className="hf-label mt-3">
        Reason (optional)
      </label>
      <textarea
        id="cancel-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={300}
        placeholder="Ordered the wrong size"
        className="hf-input resize-y"
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="hf-btn hf-btn-accent"
        >
          {pending ? "Cancelling…" : "Yes, cancel order"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="hf-btn hf-btn-outline"
        >
          Keep order
        </button>
      </div>
    </div>
  );
}
