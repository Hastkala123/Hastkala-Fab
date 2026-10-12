"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

type Tier = { id: string; name: string; description: string | null; isDefault: boolean; buyers: number; prices: number };

/** Price tiers ("Standard", "Gold", …). Prices per tier are set on each product. */
export default function TierManager({ tiers }: { tiers: Tier[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "", isDefault: false });
  const [pending, setPending] = useState(false);

  async function call(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, done: string) {
    setPending(true);
    const result = await apiRequest("/api/admin/wholesale/tiers", { method, body });
    setPending(false);
    if (!result.ok) {
      toast(result.fields?.name ?? result.error, "error");
      return false;
    }
    toast(done, "success");
    setEditing(null);
    router.refresh();
    return true;
  }

  const startEdit = (tier: Tier | null) => {
    setEditing(tier?.id ?? "new");
    setDraft({ name: tier?.name ?? "", description: tier?.description ?? "", isDefault: tier?.isDefault ?? false });
  };

  const editor = (
    <div className="space-y-2 rounded-lg border border-cotton-300 bg-cotton-50 p-3">
      <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Tier name, e.g. Gold" maxLength={40} className="hf-input" aria-label="Tier name" />
      <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Who it's for (optional)" maxLength={200} className="hf-input" aria-label="Description" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })} className="h-4 w-4 accent-indigo-ink-800" />
        Default tier (new buyers, and designs without their own tier price)
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            editing === "new"
              ? call("POST", draft, "Tier added")
              : call("PATCH", { id: editing, ...draft }, "Tier saved")
          }
          className="hf-btn hf-btn-primary py-1.5 text-sm"
        >
          Save
        </button>
        <button type="button" onClick={() => setEditing(null)} className="hf-btn hf-btn-outline py-1.5 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {tiers.map((tier) => (
          <li key={tier.id} className="hf-card p-4">
            {editing === tier.id ? (
              editor
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-indigo-ink-950">
                    {tier.name} {tier.isDefault && <span className="hf-badge ml-1 text-emerald-700">Default</span>}
                  </p>
                  {tier.description && <p className="text-xs text-slate-500">{tier.description}</p>}
                  <p className="mt-0.5 text-xs text-slate-500">
                    {tier.buyers} buyer{tier.buyers === 1 ? "" : "s"} · prices on {tier.prices} design{tier.prices === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => startEdit(tier)} className="hf-btn hf-btn-outline px-3 py-1 text-xs">
                    Edit
                  </button>
                  {!tier.isDefault && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => window.confirm(`Delete the ${tier.name} tier and its prices?`) && call("DELETE", { id: tier.id }, "Tier deleted")}
                      className="px-2 text-xs font-semibold text-madder-600"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing === "new" ? editor : (
        <button type="button" onClick={() => startEdit(null)} className="hf-btn hf-btn-outline">
          + Add a price tier
        </button>
      )}
      <p className="text-xs text-slate-500">
        Set each tier&apos;s prices in the product editor (Products → a product → Wholesale). A design with no price in a
        buyer&apos;s tier uses the default tier&apos;s prices.
      </p>
    </div>
  );
}
