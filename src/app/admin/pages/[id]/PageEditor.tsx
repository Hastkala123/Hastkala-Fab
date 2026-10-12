"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { CONTENT_PLACEHOLDERS } from "@/lib/content-text";
import { slugify } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import ContentBody from "@/components/content/ContentBody";

type PageDraft = {
  id: string;
  title: string;
  slug: string;
  type: "POLICY" | "INFO" | "LANDING";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  body: string;
  metaTitle: string;
  metaDescription: string;
  showInFooter: boolean;
  fixed: boolean;
};

const EMPTY: Omit<PageDraft, "id" | "fixed"> = {
  title: "",
  slug: "",
  type: "INFO",
  status: "DRAFT",
  body: "",
  metaTitle: "",
  metaDescription: "",
  showInFooter: false,
};

/** Edits one page, with a live preview using the shop's own styles. */
export default function PageEditor({ page, values }: { page: PageDraft | null; values: Record<string, string> }) {
  const router = useRouter();
  const { toast } = useToast();
  const [draft, setDraft] = useState(page ?? { ...EMPTY, id: "", fixed: false });
  const [slugTouched, setSlugTouched] = useState(Boolean(page));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState(false);

  const set = <K extends keyof PageDraft>(key: K, value: PageDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const address = draft.fixed ? `/${draft.slug}` : `/pages/${draft.slug || "…"}`;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setFields({});
    const data = {
      title: draft.title,
      slug: draft.slug,
      type: draft.type,
      status: draft.status,
      body: draft.body,
      metaTitle: draft.metaTitle,
      metaDescription: draft.metaDescription,
      showInFooter: draft.showInFooter,
    };
    const result = await apiRequest<{ page: { id: string } }>("/api/admin/pages", {
      method: page ? "PATCH" : "POST",
      body: page ? { id: page.id, data } : data,
    });
    setPending(false);
    if (!result.ok) {
      setFields(result.fields ?? {});
      toast(result.error, "error");
      return;
    }
    toast("Page saved", "success");
    if (!page) router.replace(`/admin/pages/${result.data.page.id}`);
    router.refresh();
  }

  async function remove() {
    if (!page || !window.confirm(`Delete "${page.title}"? This can't be undone.`)) return;
    const result = await apiRequest("/api/admin/pages", { method: "DELETE", body: { id: page.id } });
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Page deleted", "success");
    router.replace("/admin/pages");
    router.refresh();
  }

  const error = (key: string) => fields[key] && <p className="mt-1 text-xs font-medium text-madder-600">{fields[key]}</p>;

  return (
    <form onSubmit={save} className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]" noValidate>
      <div className="space-y-5">
        <div className="hf-card space-y-4 p-5">
          <div>
            <label htmlFor="pg-title" className="hf-label">Title</label>
            <input
              id="pg-title"
              value={draft.title}
              maxLength={120}
              onChange={(e) => {
                set("title", e.target.value);
                if (!slugTouched && !draft.fixed) set("slug", slugify(e.target.value).slice(0, 120));
              }}
              className="hf-input mt-1"
            />
            {error("title")}
          </div>
          <div>
            <label htmlFor="pg-slug" className="hf-label">Web address</label>
            <input
              id="pg-slug"
              value={draft.slug}
              maxLength={120}
              disabled={draft.fixed}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value.toLowerCase());
              }}
              className="hf-input mt-1 disabled:bg-cotton-100"
            />
            <p className="mt-1 text-xs text-slate-500">
              Opens at <span className="font-mono">{address}</span>
              {draft.fixed && " — linked from the footer and checkout, so it stays fixed."}
            </p>
            {error("slug")}
          </div>
        </div>

        <div className="hf-card p-5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="pg-body" className="hf-label">Page text</label>
            <button type="button" onClick={() => setPreview((p) => !p)} className="hf-btn hf-btn-outline px-3 py-1 text-xs">
              {preview ? "Edit text" : "Preview"}
            </button>
          </div>
          {preview ? (
            <div className="mt-3 min-h-80 rounded-lg border border-cotton-300 bg-white p-5">
              <h2 className="font-display text-2xl font-bold text-indigo-ink-950">{draft.title || "Untitled"}</h2>
              <ContentBody body={draft.body} values={values} className="mt-4" />
            </div>
          ) : (
            <textarea
              id="pg-body"
              value={draft.body}
              onChange={(e) => set("body", e.target.value)}
              rows={24}
              maxLength={50_000}
              className="hf-input mt-3 resize-y font-mono text-sm leading-relaxed"
            />
          )}
          {error("body")}
          <details className="mt-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold text-indigo-ink-800">How to format the text</summary>
            <ul className="mt-2 space-y-1">
              <li><code>## Heading</code> and <code>### Smaller heading</code> on their own line</li>
              <li><code>- item</code> for a list; a blank line starts a new paragraph</li>
              <li><code>**bold**</code> and <code>[link text](/contact)</code> (pages here, https://, mailto: or tel:)</li>
            </ul>
            <p className="mt-3 font-semibold text-indigo-ink-800">Values from Settings (kept up to date automatically)</p>
            <ul className="mt-1 grid gap-1 sm:grid-cols-2">
              {Object.entries(CONTENT_PLACEHOLDERS).map(([key, label]) => (
                <li key={key}>
                  <code>{`{{${key}}}`}</code> — {label}
                  {!values[key] && <span className="text-madder-600"> (not set — the line is hidden)</span>}
                </li>
              ))}
            </ul>
          </details>
        </div>

        <div className="hf-card space-y-4 p-5">
          <p className="text-sm font-semibold text-indigo-ink-900">Search results</p>
          <div>
            <label htmlFor="pg-mt" className="hf-label">Search title (optional)</label>
            <input id="pg-mt" value={draft.metaTitle} maxLength={70} onChange={(e) => set("metaTitle", e.target.value)} className="hf-input mt-1" />
            {error("metaTitle")}
          </div>
          <div>
            <label htmlFor="pg-md" className="hf-label">Search description (optional)</label>
            <textarea id="pg-md" value={draft.metaDescription} maxLength={170} rows={2} onChange={(e) => set("metaDescription", e.target.value)} className="hf-input mt-1" />
            <p className="mt-1 text-xs text-slate-500">Left empty, the start of the page text is used.</p>
            {error("metaDescription")}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="hf-card space-y-4 p-5 xl:sticky xl:top-20">
          <div>
            <label htmlFor="pg-status" className="hf-label">Status</label>
            <select id="pg-status" value={draft.status} onChange={(e) => set("status", e.target.value as PageDraft["status"])} className="hf-input mt-1">
              <option value="PUBLISHED">Published — anyone can see it</option>
              <option value="DRAFT">Draft — only staff can see it</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            {draft.fixed && draft.status !== "PUBLISHED" && (
              <p className="mt-1 text-xs text-madder-700">Checkout and sign-up link to this page — keep it published once the shop is live.</p>
            )}
          </div>
          <div>
            <label htmlFor="pg-type" className="hf-label">Kind of page</label>
            <select id="pg-type" value={draft.type} onChange={(e) => set("type", e.target.value as PageDraft["type"])} className="hf-input mt-1">
              <option value="INFO">Information</option>
              <option value="POLICY">Policy (shows &quot;last updated&quot;)</option>
              <option value="LANDING">Landing page</option>
            </select>
          </div>
          {!draft.fixed && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.showInFooter} onChange={(e) => set("showInFooter", e.target.checked)} className="h-4 w-4 accent-indigo-ink-800" />
              Show in the footer
            </label>
          )}
          <button type="submit" disabled={pending} className="hf-btn hf-btn-primary w-full">
            {pending ? "Saving…" : "Save page"}
          </button>
          {page && (
            <a href={address} target="_blank" rel="noreferrer" className="hf-btn hf-btn-outline w-full">
              View on the shop ↗
            </a>
          )}
          {page && !draft.fixed && (
            <button type="button" onClick={remove} className="w-full text-center text-xs font-semibold text-madder-600">
              Delete page
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
