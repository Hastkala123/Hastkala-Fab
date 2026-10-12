"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { INDIAN_STATES } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { Field, FormError } from "@/components/ui/Field";
import TextInput from "@/components/wholesale/TextInput";

export type ApplicationValues = {
  businessName: string;
  legalName: string;
  gstin: string;
  businessType: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  expectedVolume: string;
  socialUrl: string;
  phone: string;
};

/** Apply, re-apply, or update business details. */
export default function ApplicationForm({
  initial,
  businessTypes,
  gstinRequired,
  needsPhone,
  status,
}: {
  initial: ApplicationValues;
  businessTypes: readonly string[];
  gstinRequired: boolean;
  needsPhone: boolean;
  status: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (key: keyof ApplicationValues) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  const identityChanged =
    status === "APPROVED" &&
    (values.gstin.trim().toUpperCase() !== initial.gstin.trim().toUpperCase() ||
      values.businessName.trim().toLowerCase() !== initial.businessName.trim().toLowerCase());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (identityChanged && !window.confirm("Changing your GSTIN or business name sends your account back for review. Trade prices pause until we approve it again. Continue?")) {
      return;
    }
    setPending(true);
    setError(null);
    setFields({});
    const result = await apiRequest<{ status: string; reReview: boolean }>("/api/wholesale/apply", { body: values });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      setFields(result.fields ?? {});
      return;
    }
    toast(
      status === "NONE" || status === "REJECTED"
        ? "Application sent — we'll review it within one working day"
        : result.data.reReview
          ? "Details saved — your account is back under review"
          : "Details saved",
      "success",
    );
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Business / shop name" value={values.businessName} onChange={set("businessName")} error={fields.businessName} required maxLength={120} autoComplete="organization" />
        <TextInput label="Legal name (as on GST certificate)" value={values.legalName} onChange={set("legalName")} error={fields.legalName} maxLength={160} />
        <TextInput
          label="GSTIN"
          value={values.gstin}
          onChange={(v) => set("gstin")(v.toUpperCase())}
          error={fields.gstin}
          required={gstinRequired}
          maxLength={15}
          placeholder="08ABCDE1234F1Z5"
          hint="Lets you claim input tax credit on our GST invoices."
        />
        <Field label="Type of business" error={fields.businessType} required>
          {(props) => (
            <select {...props} value={values.businessType} onChange={(e) => set("businessType")(e.target.value)} className="hf-input">
              <option value="">Choose…</option>
              {businessTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </Field>
        <TextInput label="Shop / office address" value={values.addressLine} onChange={set("addressLine")} error={fields.addressLine} className="sm:col-span-2" autoComplete="street-address" />
        <TextInput label="City" value={values.city} onChange={set("city")} error={fields.city} required autoComplete="address-level2" />
        <Field label="State" error={fields.state} required>
          {(props) => (
            <select {...props} value={values.state} onChange={(e) => set("state")(e.target.value)} className="hf-input">
              <option value="">Choose…</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </Field>
        <TextInput label="PIN code" value={values.pincode} onChange={set("pincode")} error={fields.pincode} required maxLength={6} autoComplete="postal-code" />
        <TextInput label="Expected monthly purchase" value={values.expectedVolume} onChange={set("expectedVolume")} error={fields.expectedVolume} maxLength={80} placeholder="e.g. ₹50,000 – ₹1 lakh" />
        <TextInput label="Instagram / website (optional)" value={values.socialUrl} onChange={set("socialUrl")} error={fields.socialUrl} placeholder="instagram.com/yourshop" />
        {needsPhone && (
          <TextInput label="Mobile number" type="tel" value={values.phone} onChange={set("phone")} error={fields.phone} required autoComplete="tel" hint="We confirm wholesale orders by phone." />
        )}
      </div>
      {identityChanged && (
        <p role="alert" className="rounded-lg bg-turmeric-50 px-4 py-3 text-sm text-turmeric-900">
          Changing your GSTIN or business name sends the account back for review. Trade prices pause until it&apos;s approved again.
        </p>
      )}
      <FormError message={error} />
      <button type="submit" disabled={pending} className="hf-btn hf-btn-primary px-6">
        {pending
          ? "Saving…"
          : status === "NONE"
            ? "Apply for wholesale"
            : status === "REJECTED"
              ? "Send again for review"
              : "Save details"}
      </button>
    </form>
  );
}
