"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { Field, FormError, SubmitButton } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

export default function ProfileForm({
  initial,
}: {
  initial: {
    name: string;
    email: string;
    phone: string;
    role: string;
    businessName: string;
    gstin: string;
  };
}) {
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
    const result = await apiRequest("/api/account/profile", {
      method: "PATCH",
      body: {
        name: String(form.get("name") ?? ""),
        phone: String(form.get("phone") ?? ""),
        businessName: String(form.get("businessName") ?? ""),
        gstin: String(form.get("gstin") ?? ""),
      },
    });

    setPending(false);

    if (!result.ok) {
      setFormError(result.error);
      if (result.fields) setFields(result.fields);
      return;
    }

    toast("Profile updated", "success");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={formError} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" error={fields.name} required>
          {(props) => (
            <input
              {...props}
              name="name"
              defaultValue={initial.name}
              autoComplete="name"
              required
              maxLength={80}
              className="hf-input"
            />
          )}
        </Field>

        <div>
          <label htmlFor="email-readonly" className="hf-label">
            Email address
          </label>
          <input
            id="email-readonly"
            value={initial.email}
            readOnly
            disabled
            className="hf-input cursor-not-allowed bg-cotton-100 text-slate-500"
          />
        </div>
      </div>

      <Field label="Mobile number" error={fields.phone} hint="Used for delivery updates.">
        {(props) => (
          <input
            {...props}
            name="phone"
            type="tel"
            defaultValue={initial.phone}
            autoComplete="tel"
            maxLength={14}
            placeholder="9876543210"
            className="hf-input"
          />
        )}
      </Field>

      {initial.role === "WHOLESALE" && (
        <div className="grid gap-5 rounded-lg border border-cotton-300 bg-cotton-50 p-4 sm:grid-cols-2">
          <Field label="Business name" error={fields.businessName}>
            {(props) => (
              <input
                {...props}
                name="businessName"
                defaultValue={initial.businessName}
                maxLength={120}
                className="hf-input"
              />
            )}
          </Field>

          <Field label="GSTIN" error={fields.gstin}>
            {(props) => (
              <input
                {...props}
                name="gstin"
                defaultValue={initial.gstin}
                maxLength={15}
                className="hf-input uppercase"
              />
            )}
          </Field>
        </div>
      )}

      <SubmitButton pending={pending} pendingLabel="Saving…" className="sm:w-auto sm:px-8">
        Save changes
      </SubmitButton>
    </form>
  );
}
