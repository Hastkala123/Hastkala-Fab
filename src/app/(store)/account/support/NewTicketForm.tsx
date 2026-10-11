"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { TICKET_CATEGORY_LABELS } from "@/lib/utils";
import { Field, FormError, SubmitButton } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

export default function NewTicketForm({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setFormError(null);
    setFields({});
    const form = new FormData(event.currentTarget);
    const result = await apiRequest<{ ticket: { ticketNumber: string } }>("/api/support/tickets", {
      body: {
        subject: String(form.get("subject") ?? ""),
        category: String(form.get("category") ?? "OTHER"),
        orderNumber: String(form.get("orderNumber") ?? ""),
        message: String(form.get("message") ?? ""),
      },
    });
    setPending(false);
    if (!result.ok) {
      setFormError(result.error);
      if (result.fields) setFields(result.fields);
      return;
    }
    toast(`Ticket ${result.data.ticket.ticketNumber} created`, "success");
    router.push(`/account/support/${result.data.ticket.ticketNumber}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What is it about?" error={fields.category} required>
          {(props) => (
            <select {...props} name="category" defaultValue={orderNumber ? "ORDER" : "OTHER"} className="hf-input">
              {Object.entries(TICKET_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Order number (if any)" error={fields.orderNumber}>
          {(props) => (
            <input
              {...props}
              name="orderNumber"
              defaultValue={orderNumber}
              maxLength={20}
              placeholder="HF-100001"
              className="hf-input uppercase"
            />
          )}
        </Field>
      </div>
      <Field label="Subject" error={fields.subject} required>
        {(props) => <input {...props} name="subject" required minLength={5} maxLength={150} className="hf-input" />}
      </Field>
      <Field label="Message" error={fields.message} required>
        {(props) => (
          <textarea {...props} name="message" required minLength={10} maxLength={4000} rows={5} className="hf-input" />
        )}
      </Field>
      <SubmitButton pending={pending} pendingLabel="Sending…" className="sm:w-auto sm:px-8">
        Send
      </SubmitButton>
    </form>
  );
}
