"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

export default function CustomerRoleControl({
  userId,
  name,
  role,
  isApproved,
  canManageAdmins,
  isSelf,
}: {
  userId: string;
  name: string;
  role: string;
  isApproved: boolean;
  canManageAdmins: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  const isSuper = role === "SUPERADMIN";

  async function update(nextRole: string, nextApproved: boolean) {
    setPending(true);
    const result = await apiRequest("/api/admin/users", {
      method: "PATCH",
      body: { userId, role: nextRole, isApproved: nextApproved },
    });
    setPending(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }

    toast(`${name} updated`, "success");
    setOpen(false);
    router.refresh();
  }

  // The server enforces all of these too; hiding the controls just avoids
  // offering an action that would be rejected.
  if (isSuper || isSelf) {
    return (
      <div>
        <span className="hf-badge text-indigo-ink-700">{role}</span>
        <p className="mt-1 text-xs text-slate-400">
          {isSelf ? "This is you" : "Protected account"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="hf-badge text-indigo-ink-700">{role}</span>
        {role === "WHOLESALE" && (
          <span
            className={`hf-badge ${
              isApproved ? "text-emerald-700" : "text-turmeric-700"
            }`}
          >
            {isApproved ? "Approved" : "Pending"}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {role === "WHOLESALE" && !isApproved && (
          <button
            type="button"
            onClick={() => update("WHOLESALE", true)}
            disabled={pending}
            className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? "…" : "Approve"}
          </button>
        )}

        {role === "WHOLESALE" && isApproved && (
          <button
            type="button"
            onClick={() => update("WHOLESALE", false)}
            disabled={pending}
            className="rounded px-2 py-1 text-xs font-semibold text-madder-600 transition hover:bg-madder-50 disabled:opacity-50"
          >
            Revoke approval
          </button>
        )}

        {role === "CUSTOMER" && (
          <button
            type="button"
            onClick={() => update("WHOLESALE", true)}
            disabled={pending}
            className="rounded px-2 py-1 text-xs font-semibold text-indigo-ink-700 transition hover:bg-indigo-ink-50 disabled:opacity-50"
          >
            Make wholesale
          </button>
        )}

        {canManageAdmins && (
          <>
            {!open ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-cotton-200"
              >
                More…
              </button>
            ) : role === "ADMIN" ? (
              <button
                type="button"
                onClick={() => update("CUSTOMER", true)}
                disabled={pending}
                className="rounded bg-madder-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-madder-700 disabled:opacity-50"
              >
                Revoke admin
              </button>
            ) : (
              <button
                type="button"
                onClick={() => update("ADMIN", true)}
                disabled={pending}
                className="rounded bg-indigo-ink-800 px-2 py-1 text-xs font-semibold text-white transition hover:bg-indigo-ink-900 disabled:opacity-50"
              >
                Grant admin
              </button>
            )}
          </>
        )}
      </div>

      {open && canManageAdmins && (
        <p className="mt-1.5 text-xs text-slate-400">
          Changing a role signs the user out of all devices.
        </p>
      )}
    </div>
  );
}
