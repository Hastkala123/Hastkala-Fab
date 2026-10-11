"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { Field, FormError, SubmitButton } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { INDIAN_STATES } from "@/lib/utils";

export type AddressValues = {
  id?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  type: string;
  isDefault: boolean;
};

export default function AddressForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: AddressValues;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const editing = Boolean(initial?.id);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setFormError(null);
    setFields({});

    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      fullName: String(form.get("fullName") ?? ""),
      phone: String(form.get("phone") ?? ""),
      line1: String(form.get("line1") ?? ""),
      line2: String(form.get("line2") ?? ""),
      city: String(form.get("city") ?? ""),
      state: String(form.get("state") ?? ""),
      pincode: String(form.get("pincode") ?? ""),
      type: String(form.get("type") ?? "HOME"),
      isDefault: form.get("isDefault") === "on",
    };
    if (editing) body.id = initial!.id;

    const result = await apiRequest("/api/account/addresses", {
      method: editing ? "PATCH" : "POST",
      body,
    });

    setPending(false);

    if (!result.ok) {
      setFormError(result.error);
      if (result.fields) setFields(result.fields);
      return;
    }

    toast(editing ? "Address updated" : "Address saved", "success");
    router.refresh();
    onDone?.();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={formError} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={fields.fullName} required>
          {(props) => (
            <input
              {...props}
              name="fullName"
              defaultValue={initial?.fullName}
              autoComplete="name"
              required
              maxLength={80}
              className="hf-input"
            />
          )}
        </Field>

        <Field label="Mobile number" error={fields.phone} required>
          {(props) => (
            <input
              {...props}
              name="phone"
              type="tel"
              defaultValue={initial?.phone}
              autoComplete="tel"
              required
              maxLength={14}
              placeholder="9876543210"
              className="hf-input"
            />
          )}
        </Field>
      </div>

      <Field label="Flat, house no., building, street" error={fields.line1} required>
        {(props) => (
          <input
            {...props}
            name="line1"
            defaultValue={initial?.line1}
            autoComplete="address-line1"
            required
            maxLength={150}
            className="hf-input"
          />
        )}
      </Field>

      <Field label="Area, colony, landmark" error={fields.line2}>
        {(props) => (
          <input
            {...props}
            name="line2"
            defaultValue={initial?.line2 ?? ""}
            autoComplete="address-line2"
            maxLength={150}
            className="hf-input"
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="PIN code" error={fields.pincode} required>
          {(props) => (
            <input
              {...props}
              name="pincode"
              inputMode="numeric"
              defaultValue={initial?.pincode}
              autoComplete="postal-code"
              required
              maxLength={6}
              placeholder="302001"
              className="hf-input"
            />
          )}
        </Field>

        <Field label="City" error={fields.city} required>
          {(props) => (
            <input
              {...props}
              name="city"
              defaultValue={initial?.city}
              autoComplete="address-level2"
              required
              maxLength={60}
              className="hf-input"
            />
          )}
        </Field>

        <Field label="State" error={fields.state} required>
          {(props) => (
            <select
              {...props}
              name="state"
              defaultValue={initial?.state ?? "Rajasthan"}
              required
              className="hf-input"
            >
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <Field label="Address type" error={fields.type}>
        {(props) => (
          <select
            {...props}
            name="type"
            defaultValue={initial?.type ?? "HOME"}
            className="hf-input"
          >
            <option value="HOME">Home</option>
            <option value="WORK">Work</option>
            <option value="OTHER">Other</option>
          </select>
        )}
      </Field>

      <label className="flex items-center gap-2.5 text-sm text-slate-600">
        <input
          name="isDefault"
          type="checkbox"
          defaultChecked={initial?.isDefault}
          className="h-4 w-4 rounded border-cotton-400 accent-indigo-ink-800"
        />
        Make this my default delivery address
      </label>

      <div className="flex gap-2.5 pt-1">
        <SubmitButton pending={pending} pendingLabel="Saving…" className="flex-1">
          {editing ? "Update address" : "Save address"}
        </SubmitButton>
        {onCancel && (
          <button type="button" onClick={onCancel} className="hf-btn hf-btn-outline">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
