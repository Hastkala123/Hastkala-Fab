"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

const STATUSES = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "CONVERTED", label: "Became a buyer" },
  { value: "CLOSED", label: "Closed" },
];

/** Status and notes for one wholesale lead. */
export default function InquiryRow({ id, status, staffNotes }: { id: string; status: string; staffNotes: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [notes, setNotes] = useState(staffNotes ?? "");
  const [pending, setPending] = useState(false);

  async function save(next: { status?: string; staffNotes?: string }) {
    setPending(true);
    const result = await apiRequest("/api/admin/wholesale/inquiries", {
      method: "PATCH",
      body: { id, status: next.status, staffNotes: next.staffNotes ?? notes },
    });
    setPending(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Saved", "success");
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="text-xs">
        <span className="sr-only">Status</span>
        <select value={status} disabled={pending} onChange={(e) => save({ status: e.target.value })} className="hf-input py-1.5 text-sm">
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (called on…, sent catalogue…)"
        maxLength={2000}
        aria-label="Notes"
        className="hf-input min-w-[220px] flex-1 py-1.5 text-sm"
      />
      <button type="button" disabled={pending || notes === (staffNotes ?? "")} onClick={() => save({ staffNotes: notes })} className="hf-btn hf-btn-outline py-1.5 text-sm">
        Save note
      </button>
    </div>
  );
}
