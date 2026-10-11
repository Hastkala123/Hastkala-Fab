"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { Field, FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

export type CouponRow = {
  id: string;
  code: string;
  description: string;
  type: string;
  value: string;
  minOrderValue: string;
  maxDiscount: string;
  usageLimit: string;
  perUserLimit: string;
  usedCount: number;
  isActive: boolean;
  appliesTo: string;
  expiresAt: string;
};

const blank: Omit<CouponRow, "id" | "usedCount"> = {
  code: "",
  description: "",
  type: "PERCENT",
  value: "10",
  minOrderValue: "0",
  maxDiscount: "",
  usageLimit: "",
  perUserLimit: "1",
  isActive: true,
  appliesTo: "ALL",
  expiresAt: "",
};

export default function CouponManager({ coupons }: { coupons: CouponRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function remove(coupon: CouponRow) {
    setDeletingId(coupon.id);
    const result = await apiRequest<{ message?: string }>("/api/admin/coupons", {
      method: "DELETE",
      body: { id: coupon.id },
    });
    setDeletingId(null);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(result.data.message ?? `${coupon.code} deleted`, "success");
    router.refresh();
  }

  return (
    <div className="mt-6">
      {!creating && !editing && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="hf-btn hf-btn-primary"
        >
          + Create coupon
        </button>
      )}

      {(creating || editing) && (
        <div className="hf-card mb-6 p-5">
          <h2 className="mb-4 font-display text-base font-bold text-indigo-ink-950">
            {editing ? `Edit ${editing.code}` : "New coupon"}
          </h2>
          <CouponForm
            initial={editing ?? { ...blank, id: undefined, usedCount: 0 }}
            onDone={() => {
              setCreating(false);
              setEditing(null);
            }}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        </div>
      )}

      {coupons.length === 0 ? (
        <div className="hf-card mt-6 p-12 text-center">
          <p className="text-sm text-slate-500">
            No coupons yet. A welcome discount is the single cheapest way to
            convert first-time visitors.
          </p>
        </div>
      ) : (
        <div className="hf-card mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cotton-200 bg-cotton-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-3 font-semibold">Code</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Discount</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Conditions</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Used</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cotton-200">
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="transition hover:bg-cotton-50">
                    <td className="px-4 py-3">
                      <p className="font-mono font-bold text-indigo-ink-900">
                        {coupon.code}
                      </p>
                      {coupon.description && (
                        <p className="text-xs text-slate-400">{coupon.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-indigo-ink-900">
                        {coupon.type === "PERCENT"
                          ? `${coupon.value}%`
                          : `₹${coupon.value}`}
                      </p>
                      {coupon.maxDiscount && coupon.type === "PERCENT" && (
                        <p className="text-xs text-slate-400">
                          max ₹{coupon.maxDiscount}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <p>Min order ₹{coupon.minOrderValue}</p>
                      <p>{coupon.perUserLimit} per customer</p>
                      <p>{coupon.appliesTo}</p>
                      {coupon.expiresAt && <p>Expires {coupon.expiresAt}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-indigo-ink-900">
                        {coupon.usedCount}
                        {coupon.usageLimit && ` / ${coupon.usageLimit}`}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`hf-badge ${
                          coupon.isActive ? "text-emerald-700" : "text-slate-500"
                        }`}
                      >
                        {coupon.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(coupon);
                          setCreating(false);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="rounded px-2 py-1 text-xs font-semibold text-indigo-ink-700 transition hover:bg-indigo-ink-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(coupon)}
                        disabled={deletingId === coupon.id}
                        className="rounded px-2 py-1 text-xs font-semibold text-madder-600 transition hover:bg-madder-50 disabled:opacity-50"
                      >
                        {deletingId === coupon.id
                          ? "…"
                          : coupon.usedCount > 0
                            ? "Deactivate"
                            : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CouponForm({
  initial,
  onDone,
  onCancel,
}: {
  initial: Partial<CouponRow> & { id?: string };
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState({ ...blank, ...initial });
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const editing = Boolean(initial.id);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setFormError(null);
    setFields({});

    const body: Record<string, unknown> = {
      code: values.code,
      description: values.description,
      type: values.type,
      value: values.value,
      minOrderValue: values.minOrderValue,
      perUserLimit: values.perUserLimit,
      isActive: values.isActive,
      appliesTo: values.appliesTo,
      expiresAt: values.expiresAt,
      ...(values.maxDiscount ? { maxDiscount: values.maxDiscount } : {}),
      ...(values.usageLimit ? { usageLimit: values.usageLimit } : {}),
    };
    if (editing) body.id = initial.id;

    const result = await apiRequest("/api/admin/coupons", {
      method: editing ? "PATCH" : "POST",
      body,
    });

    setPending(false);

    if (!result.ok) {
      setFormError(result.error);
      if (result.fields) setFields(result.fields);
      return;
    }

    toast(editing ? "Coupon updated" : "Coupon created", "success");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={formError} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Coupon code" error={fields.code} required>
          {(props) => (
            <input
              {...props}
              value={values.code}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                }))
              }
              required
              maxLength={30}
              placeholder="WELCOME10"
              className="hf-input font-mono uppercase"
            />
          )}
        </Field>

        <Field label="Description" error={fields.description}>
          {(props) => (
            <input
              {...props}
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              maxLength={200}
              placeholder="10% off your first order"
              className="hf-input"
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Discount type" error={fields.type} required>
          {(props) => (
            <select
              {...props}
              value={values.type}
              onChange={(e) => setValues((v) => ({ ...v, type: e.target.value }))}
              className="hf-input"
            >
              <option value="PERCENT">Percentage off</option>
              <option value="FLAT">Flat amount off</option>
            </select>
          )}
        </Field>

        <Field
          label={values.type === "PERCENT" ? "Percentage (%)" : "Amount (₹)"}
          error={fields.value}
          required
        >
          {(props) => (
            <input
              {...props}
              type="number"
              min={0}
              max={values.type === "PERCENT" ? 100 : undefined}
              step={values.type === "PERCENT" ? 1 : 0.01}
              value={values.value}
              onChange={(e) => setValues((v) => ({ ...v, value: e.target.value }))}
              required
              className="hf-input"
            />
          )}
        </Field>

        <Field
          label="Max discount (₹)"
          error={fields.maxDiscount}
          hint={values.type === "FLAT" ? "Not used for flat discounts." : "Caps a % discount."}
        >
          {(props) => (
            <input
              {...props}
              type="number"
              min={0}
              step="0.01"
              value={values.maxDiscount}
              onChange={(e) => setValues((v) => ({ ...v, maxDiscount: e.target.value }))}
              disabled={values.type === "FLAT"}
              placeholder="500"
              className="hf-input disabled:bg-cotton-100"
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Min order (₹)" error={fields.minOrderValue}>
          {(props) => (
            <input
              {...props}
              type="number"
              min={0}
              step="0.01"
              value={values.minOrderValue}
              onChange={(e) => setValues((v) => ({ ...v, minOrderValue: e.target.value }))}
              className="hf-input"
            />
          )}
        </Field>

        <Field label="Total uses" error={fields.usageLimit} hint="Blank = unlimited">
          {(props) => (
            <input
              {...props}
              type="number"
              min={0}
              value={values.usageLimit}
              onChange={(e) => setValues((v) => ({ ...v, usageLimit: e.target.value }))}
              placeholder="∞"
              className="hf-input"
            />
          )}
        </Field>

        <Field label="Per customer" error={fields.perUserLimit}>
          {(props) => (
            <input
              {...props}
              type="number"
              min={1}
              value={values.perUserLimit}
              onChange={(e) => setValues((v) => ({ ...v, perUserLimit: e.target.value }))}
              className="hf-input"
            />
          )}
        </Field>

        <Field label="Expires on" error={fields.expiresAt} hint="Blank = never">
          {(props) => (
            <input
              {...props}
              type="date"
              value={values.expiresAt}
              onChange={(e) => setValues((v) => ({ ...v, expiresAt: e.target.value }))}
              className="hf-input"
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Applies to" error={fields.appliesTo}>
          {(props) => (
            <select
              {...props}
              value={values.appliesTo}
              onChange={(e) => setValues((v) => ({ ...v, appliesTo: e.target.value }))}
              className="hf-input"
            >
              <option value="ALL">All customers</option>
              <option value="RETAIL">Retail only</option>
              <option value="WHOLESALE">Wholesale only</option>
            </select>
          )}
        </Field>

        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-cotton-400 accent-indigo-ink-800"
            />
            <span className="font-medium text-indigo-ink-900">Active</span>
          </label>
        </div>
      </div>

      <div className="flex gap-2.5">
        <button type="submit" disabled={pending} className="hf-btn hf-btn-primary px-8">
          {pending ? "Saving…" : editing ? "Save changes" : "Create coupon"}
        </button>
        <button type="button" onClick={onCancel} className="hf-btn hf-btn-outline">
          Cancel
        </button>
      </div>
    </form>
  );
}
