"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, apiUpload } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

const KINDS = [
  { value: "GST_CERTIFICATE", label: "GST certificate" },
  { value: "SHOP_PHOTO", label: "Shop / showroom photo" },
  { value: "VISITING_CARD", label: "Visiting card" },
  { value: "OTHER", label: "Other document" },
] as const;

export type DocumentRow = { id: string; kind: string; fileName: string; createdAt: string };

/** Upload business documents (kept private; only our staff can open them). */
export default function DocumentsPanel({ documents, canRemove }: { documents: DocumentRow[]; canRemove: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [kind, setKind] = useState<string>("GST_CERTIFICATE");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", file);
    const result = await apiUpload("/api/wholesale/documents", form);
    setBusy(false);
    if (input.current) input.current.value = "";
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Document uploaded", "success");
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this document?")) return;
    const result = await apiRequest("/api/wholesale/documents", { method: "DELETE", body: { id } });
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {documents.length > 0 ? (
        <ul className="divide-y divide-cotton-200 rounded-lg border border-cotton-300">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-indigo-ink-900">{KINDS.find((k) => k.value === doc.kind)?.label ?? doc.kind}</p>
                <p className="truncate text-xs text-slate-500">
                  {doc.fileName} · {formatDate(new Date(doc.createdAt))}
                </p>
              </div>
              {canRemove && (
                <button type="button" onClick={() => remove(doc.id)} className="text-xs font-semibold text-madder-600">
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No documents yet. A GST certificate or a photo of your shop speeds up approval.</p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="doc-kind" className="hf-label">
            Document
          </label>
          <select id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="hf-input">
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <label className={`hf-btn hf-btn-outline cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? "Uploading…" : "Choose file"}
          <input
            ref={input}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-500">PDF, JPG, PNG or WebP, up to 5 MB. Only our team can see these.</p>
    </div>
  );
}
