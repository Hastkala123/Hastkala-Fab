"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { ORDER_STATUS_LABELS } from "@/lib/utils";

/**
 * Moves an order along. `allowed` comes from the server's transition table
 * for staff, and the server checks again on save — including that nobody
 * else changed the order in the meantime.
 */
export default function OrderStatusPanel({
  orderId,
  currentStatus,
  allowed,
  canNote,
}: {
  orderId: string;
  currentStatus: string;
  allowed: string[];
  canNote: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState("");
  const [courier, setCourier] = useState("");
  const [awb, setAwb] = useState("");
  const [note, setNote] = useState("");
  const [customerVisible, setCustomerVisible] = useState(true);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [internal, setInternal] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !status) return;
    if (status === "CANCELLED" && !note.trim()) {
      setFormError("Please give a reason for cancelling — the customer will see it.");
      return;
    }
    setPending(true);
    setFormError(null);
    // Until courier integration (milestone M4), tracking details travel in the note.
    const shippedNote =
      status === "SHIPPED" && (courier.trim() || awb.trim())
        ? `Shipped with ${courier.trim() || "courier"}${awb.trim() ? `, tracking number ${awb.trim()}` : ""}.`
        : "";
    const result = await apiRequest("/api/admin/orders", {
      method: "PATCH",
      body: {
        orderId,
        status,
        expectedFrom: currentStatus,
        note: [shippedNote, note.trim()].filter(Boolean).join(" "),
        customerVisible,
      },
    });
    setPending(false);
    if (!result.ok) {
      setFormError(result.error);
      router.refresh();
      return;
    }
    toast(`Order moved to ${ORDER_STATUS_LABELS[status] ?? status}`, "success");
    setStatus("");
    setNote("");
    setCourier("");
    setAwb("");
    router.refresh();
  }

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!internal.trim()) return;
    const result = await apiRequest("/api/admin/orders/note", { body: { orderId, note: internal.trim() } });
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setInternal("");
    toast("Note added", "success");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="hf-card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Update status</h2>
        {allowed.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {currentStatus === "PENDING_PAYMENT"
              ? "Waiting for the customer's payment. Unpaid orders are cancelled automatically when the payment window ends."
              : "This order is complete — no further changes."}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 space-y-3" noValidate>
            <FormError message={formError} />
            <fieldset>
              <legend className="sr-only">New status</legend>
              <div className="flex flex-wrap gap-2">
                {allowed.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={status === option}
                    onClick={() => setStatus(option)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-sm font-semibold transition ${
                      status === option
                        ? option === "CANCELLED"
                          ? "border-madder-600 bg-madder-600 text-white"
                          : "border-indigo-ink-800 bg-indigo-ink-800 text-white"
                        : "border-cotton-300 text-indigo-ink-800 hover:border-indigo-ink-500"
                    }`}
                  >
                    {ORDER_STATUS_LABELS[option] ?? option}
                  </button>
                ))}
              </div>
            </fieldset>

            {status === "SHIPPED" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-600">
                  <span className="mb-1 block font-semibold">Courier</span>
                  <input value={courier} onChange={(e) => setCourier(e.target.value)} maxLength={60} className="hf-input py-1.5 text-sm" />
                </label>
                <label className="text-xs text-slate-600">
                  <span className="mb-1 block font-semibold">Tracking number</span>
                  <input value={awb} onChange={(e) => setAwb(e.target.value)} maxLength={60} className="hf-input py-1.5 text-sm" />
                </label>
              </div>
            )}

            {status && (
              <>
                <label className="block text-xs text-slate-600">
                  <span className="mb-1 block font-semibold">
                    {status === "CANCELLED" ? "Reason (required)" : "Note (optional)"}
                  </span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={400} className="hf-input text-sm" />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={customerVisible}
                    onChange={(e) => setCustomerVisible(e.target.checked)}
                    className="accent-indigo-ink-800"
                  />
                  Show this update to the customer
                </label>
                {status === "CANCELLED" && (
                  <p className="rounded bg-madder-50 px-3 py-2 text-xs text-madder-800">
                    Stock goes back on sale and any coupon is released. Refunds for paid orders are issued from the
                    refunds screen.
                  </p>
                )}
                <button type="submit" disabled={pending} className="hf-btn hf-btn-primary w-full">
                  {pending ? "Saving…" : `Move to ${ORDER_STATUS_LABELS[status] ?? status}`}
                </button>
              </>
            )}
          </form>
        )}
      </section>

      {canNote && (
        <section className="hf-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Internal note</h2>
          <form onSubmit={addNote} className="mt-3 space-y-2">
            <label htmlFor="internal-note" className="sr-only">
              Internal note
            </label>
            <textarea
              id="internal-note"
              value={internal}
              onChange={(e) => setInternal(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Only staff see this"
              className="hf-input text-sm"
            />
            <button type="submit" disabled={!internal.trim()} className="hf-btn hf-btn-outline w-full py-1.5 text-sm">
              Add note
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
