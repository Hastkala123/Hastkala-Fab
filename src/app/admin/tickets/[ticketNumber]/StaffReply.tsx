"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { TICKET_STATUS_LABELS } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

export default function StaffReply({ ticketId, status }: { ticketId: string; status: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [nextStatus, setNextStatus] = useState("WAITING_ON_CUSTOMER");
  const [pending, setPending] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim() || pending) return;
    setPending(true);
    const result = await apiRequest("/api/admin/tickets", {
      method: "PATCH",
      body: { ticketId, body: body.trim(), isInternal, status: isInternal ? undefined : nextStatus },
    });
    setPending(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(isInternal ? "Note added" : "Reply sent", "success");
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={send} className="hf-card space-y-3 p-5">
      <label htmlFor="staff-reply" className="hf-label">
        {isInternal ? "Internal note (customer won't see it)" : "Reply to the customer"}
      </label>
      <textarea
        id="staff-reply"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        maxLength={4000}
        className="hf-input"
      />
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="accent-indigo-ink-800" />
          Internal note
        </label>
        {!isInternal && (
          <label className="flex items-center gap-2">
            Then mark as
            <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className="hf-input w-auto py-1 text-sm">
              {["WAITING_ON_CUSTOMER", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
                <option key={s} value={s}>
                  {TICKET_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="ml-auto text-xs text-slate-400">Now: {TICKET_STATUS_LABELS[status] ?? status}</span>
      </div>
      <button type="submit" disabled={pending || !body.trim()} className="hf-btn hf-btn-primary">
        {pending ? "Sending…" : isInternal ? "Add note" : "Send reply"}
      </button>
    </form>
  );
}
