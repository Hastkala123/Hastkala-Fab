"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

export default function ProductRowActions({
  productId,
  title,
  slug,
  archived,
}: {
  productId: string;
  title: string;
  slug: string;
  archived: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    const result = await apiRequest<{ archived: boolean; message?: string }>(
      "/api/admin/products",
      { method: "DELETE", body: { id: productId } },
    );
    setPending(false);
    setConfirming(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }

    toast(result.data.message ?? `"${title}" archived`, "success");
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-xs text-slate-500">
          Archive it?
        </span>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="rounded bg-madder-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-madder-700 disabled:opacity-50"
        >
          {pending ? "…" : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-cotton-200"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/products/${slug}?preview=1`}
        target="_blank"
        rel="noreferrer"
        className="rounded px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-cotton-200 hover:text-indigo-ink-800"
        title="View on store"
      >
        View
      </Link>
      <Link
        href={`/admin/products/${productId}`}
        className="rounded px-2 py-1 text-xs font-semibold text-indigo-ink-700 transition hover:bg-indigo-ink-50"
      >
        Edit
      </Link>
      {!archived && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded px-2 py-1 text-xs font-semibold text-madder-600 transition hover:bg-madder-50"
        >
          Archive
        </button>
      )}
    </div>
  );
}
