"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

type WholesaleStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

/**
 * Block/unblock an account and approve or reject wholesale buyers. Staff
 * roles are managed separately by the owner (Admin → Staff).
 */
export default function CustomerRoleControl({
  userId,
  name,
  status,
  wholesaleStatus,
  isStaff,
  isSelf,
  canManage,
  canWholesale,
}: {
  userId: string;
  name: string;
  status: "ACTIVE" | "BLOCKED" | "DELETED";
  wholesaleStatus: WholesaleStatus | null;
  isStaff: boolean;
  isSelf: boolean;
  canManage: boolean;
  canWholesale: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function update(body: Record<string, unknown>, done: string) {
    setPending(true);
    const result = await apiRequest("/api/admin/users", { method: "PATCH", body: { userId, ...body } });
    setPending(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(done, "success");
    setRejecting(false);
    setReason("");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {isStaff && <span className="hf-badge text-indigo-ink-700">Staff</span>}
        <span className={`hf-badge ${status === "ACTIVE" ? "text-emerald-700" : "text-madder-700"}`}>
          {status === "ACTIVE" ? "Active" : status === "BLOCKED" ? "Blocked" : "Deleted"}
        </span>
        {wholesaleStatus && (
          <span
            className={`hf-badge ${
              wholesaleStatus === "APPROVED" ? "text-emerald-700" : wholesaleStatus === "PENDING" ? "text-turmeric-700" : "text-madder-700"
            }`}
          >
            Wholesale: {wholesaleStatus.toLowerCase()}
          </span>
        )}
      </div>

      {!isSelf && (
        <div className="flex flex-wrap gap-1.5">
          {canWholesale && (wholesaleStatus === "PENDING" || wholesaleStatus === "REJECTED" || wholesaleStatus === "SUSPENDED") && (
            <button
              type="button"
              disabled={pending}
              onClick={() => update({ wholesaleStatus: "APPROVED" }, `${name} can now see wholesale prices`)}
              className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {wholesaleStatus === "PENDING" ? "Approve wholesale" : "Re-approve"}
            </button>
          )}
          {canWholesale && wholesaleStatus === "PENDING" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setRejecting(true)}
              className="rounded px-2 py-1 text-xs font-semibold text-madder-700 hover:bg-madder-50"
            >
              Reject
            </button>
          )}
          {canWholesale && wholesaleStatus === "APPROVED" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => update({ wholesaleStatus: "SUSPENDED" }, "Wholesale prices switched off")}
              className="rounded px-2 py-1 text-xs font-semibold text-madder-700 hover:bg-madder-50"
            >
              Suspend wholesale
            </button>
          )}
          {canManage && !isStaff && status !== "DELETED" && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                update(
                  { status: status === "ACTIVE" ? "BLOCKED" : "ACTIVE" },
                  status === "ACTIVE" ? `${name} is blocked and signed out` : `${name} is unblocked`,
                )
              }
              className="rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-cotton-200"
            >
              {status === "ACTIVE" ? "Block" : "Unblock"}
            </button>
          )}
        </div>
      )}

      {rejecting && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim()) void update({ wholesaleStatus: "REJECTED", rejectionReason: reason.trim() }, "Application rejected");
          }}
          className="space-y-1.5"
        >
          <label className="block text-xs text-slate-600">
            <span className="font-semibold">Reason (the buyer sees this)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="hf-input mt-1 py-1.5 text-sm" />
          </label>
          <div className="flex gap-1.5">
            <button type="submit" disabled={pending || !reason.trim()} className="rounded bg-madder-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
              Reject application
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="rounded px-2 py-1 text-xs font-semibold text-slate-500">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
