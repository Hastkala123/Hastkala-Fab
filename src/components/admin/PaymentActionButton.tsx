"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

type Action =
  | { action: "sync"; orderId: string }
  | { action: "resolve"; paymentId: string }
  | { action: "retry-refund"; refundId: string };

const DONE: Record<Action["action"], string> = {
  sync: "Checked with the payment gateway",
  resolve: "Marked as resolved",
  "retry-refund": "Refund sent again",
};

/** One staff payment action (check with gateway, resolve a flag, retry a refund). */
export default function PaymentActionButton({
  body,
  label,
  confirmText,
  className = "hf-btn hf-btn-outline px-3 py-1.5 text-xs",
}: {
  body: Action;
  label: string;
  confirmText?: string;
  className?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function run() {
    if (confirmText && !window.confirm(confirmText)) return;
    setPending(true);
    const result = await apiRequest("/api/admin/payments", { body });
    setPending(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(DONE[body.action], "success");
    router.refresh();
  }

  return (
    <button type="button" onClick={run} disabled={pending} className={className}>
      {pending ? "Working…" : label}
    </button>
  );
}
