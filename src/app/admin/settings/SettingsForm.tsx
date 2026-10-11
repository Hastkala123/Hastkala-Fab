"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { SETTING_SECTIONS, type SettingField, type SettingSection } from "@/lib/settings-fields";
import { useToast } from "@/components/ui/Toast";

type Values = Record<string, Record<string, unknown>>;

/** Paise ↔ the rupee text in the input. */
const toInput = (field: SettingField, value: unknown): string | boolean => {
  if (field.kind === "bool") return Boolean(value);
  if (value == null) return "";
  if (field.kind === "money" || field.kind === "money-or-blank") return String(Number(value) / 100);
  return String(value);
};

function fromInput(field: SettingField, raw: string | boolean): unknown {
  if (field.kind === "bool") return Boolean(raw);
  const text = String(raw).trim();
  if (field.kind === "money-or-blank" && text === "") return null;
  if (field.kind === "money" || field.kind === "money-or-blank") return Math.round(Number(text || 0) * 100);
  if (field.kind === "int") return Math.round(Number(text || 0));
  return text;
}

export default function SettingsForm({ values, unsaved }: { values: Values; unsaved: string[] }) {
  return (
    <div className="mt-6 space-y-6">
      {SETTING_SECTIONS.map((section) => (
        <Section key={section.key} section={section} initial={values[section.key] ?? {}} unsaved={unsaved.includes(section.key)} />
      ))}
    </div>
  );
}

function Section({ section, initial, unsaved }: { section: SettingSection; initial: Record<string, unknown>; unsaved: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(section.fields.map((f) => [f.name, toInput(f, initial[f.name])])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    const value = { ...initial, ...Object.fromEntries(section.fields.map((f) => [f.name, fromInput(f, form[f.name] ?? "")])) };
    const result = await apiRequest("/api/admin/settings", { method: "PUT", body: { key: section.key, value } });
    setPending(false);
    if (!result.ok) {
      toast(result.error, "error");
      if (result.fields) {
        setErrors(Object.fromEntries(Object.entries(result.fields).map(([k, v]) => [k.replace(/^value\./, ""), v])));
      }
      return;
    }
    toast(`${section.title} saved`, "success");
    router.refresh();
  }

  return (
    <form id={section.key.replace(".", "-")} onSubmit={save} className="hf-card scroll-mt-24 p-5" noValidate>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">{section.title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{section.description}</p>
        </div>
        {unsaved && <span className="hf-badge text-turmeric-800">Not confirmed</span>}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {section.fields.map((field) => {
          const id = `${section.key}-${field.name}`;
          const error = errors[field.name];
          if (field.kind === "bool") {
            return (
              <label key={field.name} className="flex items-start gap-2.5 text-sm text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(form[field.name])}
                  onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 accent-indigo-ink-800"
                />
                <span>
                  {field.label}
                  {field.hint && <span className="block text-xs text-slate-500">{field.hint}</span>}
                </span>
              </label>
            );
          }
          return (
            <div key={field.name} className={field.kind === "textarea" ? "sm:col-span-2" : undefined}>
              <label htmlFor={id} className="hf-label">
                {field.label}
              </label>
              {field.kind === "select" ? (
                <select
                  id={id}
                  value={String(form[field.name] ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
                  className="hf-input mt-1"
                >
                  {field.options!.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : field.kind === "textarea" ? (
                <textarea
                  id={id}
                  value={String(form[field.name] ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
                  rows={3}
                  className="hf-input mt-1"
                />
              ) : (
                <input
                  id={id}
                  type={field.kind === "text" ? "text" : "number"}
                  inputMode={field.kind === "text" ? undefined : "decimal"}
                  min={field.kind === "text" ? undefined : 0}
                  step={field.kind === "int" ? 1 : field.kind === "text" ? undefined : "0.01"}
                  value={String(form[field.name] ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
                  aria-invalid={Boolean(error)}
                  className="hf-input mt-1"
                />
              )}
              {error ? (
                <p className="mt-1 text-xs font-medium text-madder-600">{error}</p>
              ) : (
                field.hint && <p className="mt-1 text-xs text-slate-500">{field.hint}</p>
              )}
            </div>
          );
        })}
      </div>

      <button type="submit" disabled={pending} className="hf-btn hf-btn-primary mt-5">
        {pending ? "Saving…" : `Save ${section.title.toLowerCase()}`}
      </button>
    </form>
  );
}
