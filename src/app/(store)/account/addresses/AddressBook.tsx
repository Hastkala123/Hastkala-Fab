"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import AddressForm, { type AddressValues } from "@/components/store/AddressForm";
import { formatIndianMobile } from "@/lib/phone";

export default function AddressBook({ addresses }: { addresses: AddressValues[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function remove(id: string) {
    setDeletingId(id);
    const result = await apiRequest("/api/account/addresses", {
      method: "DELETE",
      body: { id },
    });
    setDeletingId(null);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Address deleted", "success");
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-4">
      {!adding && addresses.length < 10 && (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setEditingId(null);
          }}
          className="hf-btn hf-btn-primary"
        >
          + Add a new address
        </button>
      )}

      {adding && (
        <div className="hf-card p-5">
          <h2 className="mb-4 font-display text-lg font-bold text-indigo-ink-950">
            New address
          </h2>
          <AddressForm
            onDone={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {addresses.length === 0 && !adding && (
        <div className="hf-card p-10 text-center">
          <p className="text-sm text-slate-500">
            You have not saved an address yet. Add one to check out faster.
          </p>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {addresses.map((address) => (
          <li key={address.id} className="hf-card p-5">
            {editingId === address.id ? (
              <>
                <h2 className="mb-4 font-display text-base font-bold text-indigo-ink-950">
                  Edit address
                </h2>
                <AddressForm
                  initial={address}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-cotton-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                      {address.label}
                    </span>
                    {address.isDefault && (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        Default
                      </span>
                    )}
                  </div>
                </div>

                <address className="mt-3 text-sm not-italic leading-relaxed text-slate-700">
                  <strong className="text-indigo-ink-900">{address.fullName}</strong>
                  <br />
                  {address.line1}
                  {address.line2 && (
                    <>
                      <br />
                      {address.line2}
                    </>
                  )}
                  {address.landmark && (
                    <>
                      <br />
                      {address.landmark}
                    </>
                  )}
                  <br />
                  {address.city}, {address.state} {address.pincode}
                  <br />
                  Phone: {formatIndianMobile(address.phone)}
                  {address.gstin && (
                    <>
                      <br />
                      GSTIN: {address.gstin}
                    </>
                  )}
                </address>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(address.id!);
                      setAdding(false);
                    }}
                    className="hf-btn hf-btn-outline py-1.5 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(address.id!)}
                    disabled={deletingId === address.id}
                    className="hf-btn hf-btn-ghost py-1.5 text-sm text-madder-600 hover:bg-madder-50"
                  >
                    {deletingId === address.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
