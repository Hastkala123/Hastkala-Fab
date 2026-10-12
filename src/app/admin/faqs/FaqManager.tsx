"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

type Faq = { id: string; question: string; answer: string; group: string; isActive: boolean };
type Draft = Omit<Faq, "id">;

const EMPTY: Draft = { question: "", answer: "", group: "General", isActive: true };

/** Add, edit, hide and delete questions. Order is set with the list below it. */
export default function FaqManager({ faqs, groups }: { faqs: Faq[]; groups: string[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function call(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, done: string) {
    setPending(true);
    setFields({});
    const result = await apiRequest("/api/admin/faqs", { method, body });
    setPending(false);
    if (!result.ok) {
      setFields(result.fields ?? {});
      toast(result.error, "error");
      return;
    }
    toast(done, "success");
    setEditing(null);
    router.refresh();
  }

  const start = (faq: Faq | null) => {
    setFields({});
    setEditing(faq?.id ?? "new");
    setDraft(faq ? { question: faq.question, answer: faq.answer, group: faq.group, isActive: faq.isActive } : EMPTY);
  };

  const error = (key: string) => fields[key] && <p className="mt-1 text-xs font-medium text-madder-600">{fields[key]}</p>;

  const editor = (
    <div className="space-y-3 rounded-lg border border-cotton-300 bg-cotton-50 p-4">
      <div>
        <label htmlFor="faq-q" className="hf-label">Question</label>
        <input id="faq-q" value={draft.question} maxLength={300} onChange={(e) => setDraft({ ...draft, question: e.target.value })} className="hf-input mt-1" />
        {error("question")}
      </div>
      <div>
        <label htmlFor="faq-a" className="hf-label">Answer</label>
        <textarea id="faq-a" value={draft.answer} maxLength={5000} rows={5} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} className="hf-input mt-1 resize-y" />
        <p className="mt-1 text-xs text-slate-500">
          Use <code>**bold**</code>, <code>[link](/returns-policy)</code> and Settings values like <code>{"{{returnDays}}"}</code>.
        </p>
        {error("answer")}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="faq-g" className="hf-label">Topic</label>
          <input id="faq-g" list="faq-groups" value={draft.group} maxLength={40} onChange={(e) => setDraft({ ...draft, group: e.target.value })} className="hf-input mt-1" />
          <datalist id="faq-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          {error("group")}
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} className="h-4 w-4 accent-indigo-ink-800" />
          Show on the website
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => (editing === "new" ? call("POST", draft, "Question added") : call("PATCH", { id: editing, data: draft }, "Question saved"))}
          className="hf-btn hf-btn-primary py-1.5 text-sm"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(null)} className="hf-btn hf-btn-outline py-1.5 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="mt-6 max-w-3xl space-y-3">
      {editing === "new" ? editor : (
        <button type="button" onClick={() => start(null)} className="hf-btn hf-btn-primary">
          + Add a question
        </button>
      )}
      <ul className="space-y-2">
        {faqs.map((faq) => (
          <li key={faq.id} className="hf-card p-4">
            {editing === faq.id ? (
              editor
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-indigo-ink-950">{faq.question}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {faq.group}
                    {!faq.isActive && <span className="ml-1 font-semibold text-madder-600">· hidden</span>}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{faq.answer}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => start(faq)} className="hf-btn hf-btn-outline px-3 py-1 text-xs">
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => window.confirm("Delete this question?") && call("DELETE", { id: faq.id }, "Question deleted")}
                    className="px-2 text-xs font-semibold text-madder-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {faqs.length === 0 && editing !== "new" && <p className="text-sm text-slate-500">No questions yet.</p>}
    </div>
  );
}
