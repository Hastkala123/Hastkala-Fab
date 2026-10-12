"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { FormError } from "@/components/ui/Field";
import TextInput from "./TextInput";

/** Wholesale enquiry (no account needed). Becomes a lead in Admin → Wholesale. */
export default function InquiryForm({
  categories,
  preselected = [],
  source,
}: {
  categories: string[];
  preselected?: string[];
  source: string;
}) {
  const [values, setValues] = useState({ name: "", phone: "", email: "", businessName: "", city: "", message: "", website: "" });
  const [chosen, setChosen] = useState<string[]>(preselected);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof values) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFields({});
    const result = await apiRequest("/api/wholesale/inquiry", {
      body: { ...values, categoriesOfInterest: chosen, source },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      setFields(result.fields ?? {});
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" className="rounded-card border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="font-display text-xl font-bold text-emerald-900">Thank you — we&apos;ve got your enquiry</p>
        <p className="mt-2 text-sm text-emerald-800">We&apos;ll call or WhatsApp you within one working day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Your name" value={values.name} onChange={set("name")} error={fields.name} required autoComplete="name" />
        <TextInput label="Mobile number" type="tel" value={values.phone} onChange={set("phone")} error={fields.phone} required autoComplete="tel" />
        <TextInput label="Business / shop name" value={values.businessName} onChange={set("businessName")} error={fields.businessName} autoComplete="organization" />
        <TextInput label="City" value={values.city} onChange={set("city")} error={fields.city} autoComplete="address-level2" />
        <TextInput label="Email (optional)" type="email" value={values.email} onChange={set("email")} error={fields.email} autoComplete="email" />
      </div>

      {categories.length > 0 && (
        <fieldset>
          <legend className="hf-label">Interested in</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {categories.map((name) => {
              const on = chosen.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setChosen((c) => (on ? c.filter((x) => x !== name) : [...c, name]))}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    on ? "border-indigo-ink-800 bg-indigo-ink-800 text-white" : "border-cotton-400 text-slate-700 hover:border-indigo-ink-400"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div>
        <label htmlFor="inq-message" className="hf-label">
          What are you looking for? (optional)
        </label>
        <textarea
          id="inq-message"
          rows={3}
          maxLength={1000}
          value={values.message}
          onChange={(e) => set("message")(e.target.value)}
          placeholder="Designs, quantities, colours, delivery city…"
          className="hf-input mt-1 resize-y"
        />
        {fields.message && <p className="mt-1 text-xs font-medium text-madder-600">{fields.message}</p>}
      </div>

      {/* Left empty by people; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="inq-website">Website</label>
        <input id="inq-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => set("website")(e.target.value)} />
      </div>

      <FormError message={error} />
      <button type="submit" disabled={pending} className="hf-btn hf-btn-accent w-full py-3 sm:w-auto sm:px-8">
        {pending ? "Sending…" : "Send enquiry"}
      </button>
      <p className="text-xs text-slate-500">We use your number only to reply to this enquiry.</p>
    </form>
  );
}
