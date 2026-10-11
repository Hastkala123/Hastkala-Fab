"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { Field, FormError, SubmitButton } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

export default function TicketReply({ ticketId }: { ticketId: string }) {
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

    const form = event.currentTarget;
    const data = new FormData(form);

    const result = await apiRequest("/api/support/tickets", {
      method: "PATCH",
      body: { ticketId, body: String(data.get("body") ?? "") },
    });

    setPending(false);

    if (!result.ok) {
      setFormError(result.error);
      if (result.fields) setFields(result.fields);
      return;
    }

    form.reset();
    toast("Reply sent", "success");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="hf-card space-y-4 p-5" noValidate>
      <h2 className="font-display text-base font-bold text-indigo-ink-950">
        Add a reply
      </h2>

      <FormError message={formError} />

      <Field label="Your message" error={fields.body} required>
        {(props) => (
          <textarea
            {...props}
            name="body"
            rows={4}
            required
            maxLength={4000}
            placeholder="Tell us more…"
            className="hf-input resize-y"
          />
        )}
      </Field>

      <SubmitButton pending={pending} pendingLabel="Sending…" className="sm:w-auto sm:px-8">
        Send reply
      </SubmitButton>
    </form>
  );
}
