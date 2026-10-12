"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Field, FormError, SubmitButton } from "@/components/ui/Field";

type TrackedOrder = {
  orderNumber: string;
  statusLabel: string;
  placedAt: string;
  items: { title: string; variantLabel: string | null; quantity: number }[];
  history: { status: string; label: string; note: string | null; at: string }[];
};

export default function TrackForm({ initialOrderNumber }: { initialOrderNumber: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setFields({});
    const result = await apiRequest<{ order: TrackedOrder }>("/api/orders/track", {
      body: { orderNumber: String(form.get("orderNumber") ?? ""), contact: String(form.get("contact") ?? "") },
    });
    setPending(false);
    if (!result.ok) {
      setOrder(null);
      setError(result.error);
      setFields(result.fields ?? {});
      return;
    }
    setOrder(result.data.order);
  }

  return (
    <div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="Order number" error={fields.orderNumber} required>
          {(props) => (
            <input
              {...props}
              name="orderNumber"
              defaultValue={initialOrderNumber}
              required
              maxLength={12}
              autoComplete="off"
              placeholder="HF-100001"
              className="hf-input uppercase"
            />
          )}
        </Field>
        <Field label="Email or mobile number" error={fields.contact} required>
          {(props) => (
            <input {...props} name="contact" required maxLength={254} autoComplete="email" placeholder="you@example.com or 98XXXXXXXX" className="hf-input" />
          )}
        </Field>
        <SubmitButton pending={pending} pendingLabel="Looking up…" className="sm:w-auto sm:px-8">
          Track order
        </SubmitButton>
      </form>

      {order && (
        <section aria-live="polite" className="mt-8 border-t border-cotton-200 pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-indigo-ink-950">Order {order.orderNumber}</h2>
            <span className="hf-badge text-indigo-ink-800">{order.statusLabel}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Placed on {formatDate(new Date(order.placedAt))}</p>

          <ul className="mt-4 space-y-1 text-sm text-slate-700">
            {order.items.map((item, i) => (
              <li key={i}>
                {item.quantity} × {item.title}
                {item.variantLabel && <span className="text-slate-500"> ({item.variantLabel})</span>}
              </li>
            ))}
          </ul>

          <ol className="mt-6 space-y-3">
            {order.history.map((event, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-ink-600" />
                <div>
                  <p className="font-medium text-indigo-ink-900">{event.label}</p>
                  {event.note && <p className="text-xs text-slate-500">{event.note}</p>}
                  <time dateTime={event.at} className="text-xs text-slate-400">
                    {formatDateTime(new Date(event.at))}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
