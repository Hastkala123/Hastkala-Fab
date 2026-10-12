"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

type Tier = { id: string; name: string; isDefault: boolean };
type Terms = {
  priceTierId: string | null;
  paymentTerms: "PREPAID" | "ADVANCE_BALANCE" | "CREDIT";
  advancePercent: number | null;
  creditLimit: number | null;
  creditDays: number | null;
  staffNotes: string | null;
};

/**
 * Approve (choosing tier and payment terms), reject with a reason, suspend,
 * reinstate, or change the terms of an approved buyer.
 */
export default function ReviewPanel({
  profileId,
  status,
  tiers,
  terms,
  defaults,
}: {
  profileId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  tiers: Tier[];
  terms: Terms;
  defaults: { advancePercent: number; creditDays: number };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState({
    priceTierId: terms.priceTierId ?? tiers.find((t) => t.isDefault)?.id ?? tiers[0]?.id ?? "",
    paymentTerms: terms.paymentTerms,
    advancePercent: terms.advancePercent != null ? String(terms.advancePercent) : "",
    creditLimit: terms.creditLimit != null ? String(terms.creditLimit / 100) : "",
    creditDays: terms.creditDays != null ? String(terms.creditDays) : "",
    staffNotes: terms.staffNotes ?? "",
  });
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"idle" | "reject" | "suspend">("idle");
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function send(body: Record<string, unknown>, done: string) {
    setPending(true);
    setFields({});
    const result = await apiRequest("/api/admin/wholesale", { method: "PATCH", body: { profileId, ...body } });
    setPending(false);
    if (!result.ok) {
      setFields(result.fields ?? {});
      toast(result.error, "error");
      return;
    }
    toast(done, "success");
    setMode("idle");
    setReason("");
    router.refresh();
  }

  const termsBody = { ...form };
  const approvedLike = status === "APPROVED" || status === "SUSPENDED";

  return (
    <div className="space-y-4">
      {status !== "REJECTED" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">
            <span className="hf-label">Price tier</span>
            <select value={form.priceTierId} onChange={(e) => setForm({ ...form, priceTierId: e.target.value })} className="hf-input">
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
            {fields.priceTierId && <span className="text-xs text-madder-600">{fields.priceTierId}</span>}
          </label>
          <label className="text-sm">
            <span className="hf-label">Payment terms</span>
            <select
              value={form.paymentTerms}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value as Terms["paymentTerms"] })}
              className="hf-input"
            >
              <option value="PREPAID">Pay before dispatch</option>
              <option value="ADVANCE_BALANCE">Advance + balance before dispatch</option>
              <option value="CREDIT">Credit (pay later)</option>
            </select>
          </label>
          {form.paymentTerms === "ADVANCE_BALANCE" && (
            <label className="text-sm">
              <span className="hf-label">Advance %</span>
              <input
                type="number"
                min={1}
                max={99}
                value={form.advancePercent}
                placeholder={`${defaults.advancePercent} (store default)`}
                onChange={(e) => setForm({ ...form, advancePercent: e.target.value })}
                className="hf-input"
              />
              {fields.advancePercent && <span className="text-xs text-madder-600">{fields.advancePercent}</span>}
            </label>
          )}
          {form.paymentTerms === "CREDIT" && (
            <>
              <label className="text-sm">
                <span className="hf-label">Credit limit (₹)</span>
                <input
                  type="number"
                  min={0}
                  value={form.creditLimit}
                  placeholder="Blank = no limit"
                  onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                  className="hf-input"
                />
                {fields.creditLimit && <span className="text-xs text-madder-600">{fields.creditLimit}</span>}
              </label>
              <label className="text-sm">
                <span className="hf-label">Days to pay</span>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={form.creditDays}
                  placeholder={`${defaults.creditDays} (store default)`}
                  onChange={(e) => setForm({ ...form, creditDays: e.target.value })}
                  className="hf-input"
                />
                {fields.creditDays && <span className="text-xs text-madder-600">{fields.creditDays}</span>}
              </label>
            </>
          )}
          <label className="text-sm sm:col-span-2 lg:col-span-3">
            <span className="hf-label">Notes for staff (not shown to the buyer)</span>
            <textarea
              rows={2}
              maxLength={2000}
              value={form.staffNotes}
              onChange={(e) => setForm({ ...form, staffNotes: e.target.value })}
              className="hf-input resize-y"
            />
          </label>
        </div>
      )}

      {mode !== "idle" && (
        <div className="rounded-lg border border-madder-200 bg-madder-50 p-3">
          <label className="text-sm">
            <span className="hf-label">{mode === "reject" ? "Reason (the buyer sees this)" : "Reason (optional, the buyer sees this)"}</span>
            <textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="hf-input resize-y" />
            {fields.reason && <span className="text-xs text-madder-600">{fields.reason}</span>}
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                send(
                  mode === "reject" ? { action: "reject", reason } : { action: "suspend", reason },
                  mode === "reject" ? "Application rejected" : "Account suspended",
                )
              }
              className="hf-btn hf-btn-accent py-1.5 text-sm"
            >
              {mode === "reject" ? "Reject application" : "Suspend account"}
            </button>
            <button type="button" onClick={() => setMode("idle")} className="hf-btn hf-btn-outline py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          {status === "PENDING" && (
            <>
              <button type="button" disabled={pending} onClick={() => send({ action: "approve", ...termsBody }, "Approved — trade prices are on for this buyer")} className="hf-btn bg-emerald-600 py-1.5 text-sm text-white hover:bg-emerald-700">
                Approve
              </button>
              <button type="button" disabled={pending} onClick={() => setMode("reject")} className="hf-btn hf-btn-outline py-1.5 text-sm text-madder-700">
                Reject…
              </button>
            </>
          )}
          {status === "REJECTED" && <p className="text-xs text-slate-500">The buyer can fix their details and send the application again.</p>}
          {approvedLike && (
            <button type="button" disabled={pending} onClick={() => send({ action: "update-terms", ...termsBody }, "Terms saved")} className="hf-btn hf-btn-primary py-1.5 text-sm">
              Save tier and terms
            </button>
          )}
          {status === "APPROVED" && (
            <button type="button" disabled={pending} onClick={() => setMode("suspend")} className="hf-btn hf-btn-outline py-1.5 text-sm text-madder-700">
              Suspend…
            </button>
          )}
          {status === "SUSPENDED" && (
            <button type="button" disabled={pending} onClick={() => send({ action: "reinstate" }, "Account reinstated")} className="hf-btn bg-emerald-600 py-1.5 text-sm text-white hover:bg-emerald-700">
              Reinstate
            </button>
          )}
        </div>
      )}
    </div>
  );
}
