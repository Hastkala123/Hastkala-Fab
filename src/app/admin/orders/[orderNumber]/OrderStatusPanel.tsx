"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { Field, FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { STATUS_LABELS } from "@/lib/utils";

/**
 * Mirrors the server's transition table in src/app/api/admin/orders/route.ts.
 * Duplicated deliberately: this copy improves the UI, the server copy is the
 * one that actually enforces the rule.
 */
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

export default function OrderStatusPanel({
  orderId,
  currentStatus,
  trackingNumber,
  courierName,
}: {
  orderId: string;
  currentStatus: string;
  trackingNumber: string;
  courierName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState("");
  const [tracking, setTracking] = useState(trackingNumber);
  const [courier, setCourier] = useState(courierName);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const allowed = TRANSITIONS[currentStatus] ?? [];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !status) return;

    setPending(true);
    setFormError(null);

    const result = await apiRequest("/api/admin/orders", {
      method: "PATCH",
      body: {
        orderId,
        status,
        trackingNumber: tracking,
        courierName: courier,
        note,
      },
    });

    setPending(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    toast(`Order marked ${STATUS_LABELS[status] ?? status}`, "success");
    setStatus("");
    setNote("");
    router.refresh();
  }

  if (allowed.length === 0) {
    return (
      <section className="hf-card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Update status
        </h2>
        <p className="mt-3 text-sm text-slate-500">
          This order is {currentStatus.toLowerCase()} — a terminal state. No further
          status changes are possible.
        </p>
      </section>
    );
  }

  return (
    <section className="hf-card p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Update status
      </h2>

      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        <FormError message={formError} />

        <Field label="Move to" required>
          {(props) => (
            <select
              {...props}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
              className="hf-input"
            >
              <option value="">Choose a status…</option>
              {allowed.map((next) => (
                <option key={next} value={next}>
                  {STATUS_LABELS[next] ?? next}
                </option>
              ))}
            </select>
          )}
        </Field>

        {(status === "SHIPPED" || currentStatus === "SHIPPED") && (
          <>
            <Field label="Courier">
              {(props) => (
                <input
                  {...props}
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  maxLength={60}
                  placeholder="Delhivery"
                  className="hf-input"
                />
              )}
            </Field>

            <Field label="Tracking number">
              {(props) => (
                <input
                  {...props}
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  maxLength={60}
                  placeholder="DL1234567890"
                  className="hf-input font-mono text-sm"
                />
              )}
            </Field>
          </>
        )}

        <Field label="Internal note" hint="Shown to the customer in order history.">
          {(props) => (
            <textarea
              {...props}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              className="hf-input resize-y"
            />
          )}
        </Field>

        {(status === "CANCELLED" || status === "RETURNED") && (
          <p className="rounded-lg bg-turmeric-50 px-3 py-2 text-xs text-turmeric-900">
            Marking this order {status.toLowerCase()} will return all its stock to
            inventory.
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !status}
          className="hf-btn hf-btn-primary w-full"
        >
          {pending ? "Updating…" : "Update order"}
        </button>
      </form>
    </section>
  );
}
