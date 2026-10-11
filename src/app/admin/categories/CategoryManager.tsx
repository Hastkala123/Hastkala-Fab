"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { Field, FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { slugify } from "@/lib/utils";
import ImageUploader from "@/components/admin/ImageUploader";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  bottomContent: string;
  imageUrl: string;
  bannerImageUrl: string;
  parentId: string;
  parentName: string | null;
  parentSlug: string | null;
  hsnCodeId: string;
  isActive: boolean;
  showInMenu: boolean;
  metaTitle: string;
  metaDescription: string;
  productCount: number;
  childCount: number;
};

export type HsnChoice = { id: string; code: string; description: string };

const blank = (): Omit<CategoryRow, "productCount" | "childCount" | "parentName" | "parentSlug" | "id"> => ({
  name: "",
  slug: "",
  description: "",
  bottomContent: "",
  imageUrl: "",
  bannerImageUrl: "",
  parentId: "",
  hsnCodeId: "",
  isActive: true,
  showInMenu: true,
  metaTitle: "",
  metaDescription: "",
});

export default function CategoryManager({ categories, hsnCodes }: { categories: CategoryRow[]; hsnCodes: HsnChoice[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const parents = categories.filter((c) => !c.parentId);
  const topLevel = categories.filter((c) => !c.parentId);

  async function remove(category: CategoryRow) {
    setDeletingId(category.id);
    const result = await apiRequest("/api/admin/categories", {
      method: "DELETE",
      body: { id: category.id },
    });
    setDeletingId(null);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`"${category.name}" deleted`, "success");
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
          + Add category
        </button>
      )}

      {(creating || editing) && (
        <div className="hf-card mb-6 p-5">
          <h2 className="mb-4 font-display text-base font-bold text-indigo-ink-950">
            {editing ? `Edit "${editing.name}"` : "New category"}
          </h2>
          <CategoryForm
            initial={editing ?? { ...blank(), id: undefined }}
            parents={parents.filter((p) => p.id !== editing?.id)}
            hsnCodes={hsnCodes}
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

      {categories.length === 0 ? (
        <div className="hf-card mt-6 p-12 text-center">
          <p className="text-sm text-slate-500">
            No categories yet. Create Kurtis, Sarees, Suits and Bedsheets to get
            started.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {topLevel.map((parent) => {
            const children = categories.filter((c) => c.parentId === parent.id);
            return (
              <li key={parent.id} className="hf-card overflow-hidden">
                <Row
                  category={parent}
                  onEdit={() => {
                    setEditing(parent);
                    setCreating(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onDelete={() => remove(parent)}
                  deleting={deletingId === parent.id}
                />

                {children.length > 0 && (
                  <ul className="border-t border-cotton-200 bg-cotton-50">
                    {children.map((child) => (
                      <li key={child.id} className="border-b border-cotton-200 last:border-0">
                        <div className="pl-8">
                          <Row
                            category={child}
                            nested
                            onEdit={() => {
                              setEditing(child);
                              setCreating(false);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            onDelete={() => remove(child)}
                            deleting={deletingId === child.id}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Row({
  category,
  nested,
  onEdit,
  onDelete,
  deleting,
}: {
  category: CategoryRow;
  nested?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const blocked = category.productCount > 0 || category.childCount > 0;

  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <div className="relative aspect-square w-11 shrink-0 overflow-hidden rounded-lg bg-cotton-200">
        {category.imageUrl ? (
          <Image src={category.imageUrl} alt="" fill sizes="44px" className="object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-cotton-500">
            ✦
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={`font-semibold text-indigo-ink-900 ${nested ? "text-sm" : ""}`}
          >
            {category.name}
          </p>
          {!category.isActive && (
            <span className="hf-badge text-slate-500">Hidden</span>
          )}
        </div>
        <p className="text-xs text-slate-400">
          /{category.parentSlug ? `${category.parentSlug}/` : ""}{category.slug} · {category.productCount}{" "}
          {category.productCount === 1 ? "product" : "products"}
          {category.childCount > 0 && ` · ${category.childCount} sub-categories`}
        </p>
      </div>

      {confirming ? (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Delete?</span>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded bg-madder-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-madder-700 disabled:opacity-50"
          >
            {deleting ? "…" : "Yes"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-cotton-200"
          >
            No
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded px-2.5 py-1 text-xs font-semibold text-indigo-ink-700 transition hover:bg-indigo-ink-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={blocked}
            title={
              blocked
                ? "Move or delete its products and sub-categories first"
                : undefined
            }
            className="rounded px-2.5 py-1 text-xs font-semibold text-madder-600 transition hover:bg-madder-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function CategoryForm({
  initial,
  parents,
  hsnCodes,
  onDone,
  onCancel,
}: {
  initial: Partial<CategoryRow> & { id?: string };
  parents: CategoryRow[];
  hsnCodes: HsnChoice[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState({
    name: initial.name ?? "",
    slug: initial.slug ?? "",
    description: initial.description ?? "",
    bottomContent: initial.bottomContent ?? "",
    imageUrl: initial.imageUrl ?? "",
    bannerImageUrl: initial.bannerImageUrl ?? "",
    parentId: initial.parentId ?? "",
    hsnCodeId: initial.hsnCodeId ?? "",
    isActive: initial.isActive ?? true,
    showInMenu: initial.showInMenu ?? true,
    metaTitle: initial.metaTitle ?? "",
    metaDescription: initial.metaDescription ?? "",
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
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

    const result = await apiRequest("/api/admin/categories", {
      method: editing ? "PATCH" : "POST",
      body: editing ? { id: initial.id, data: values } : values,
    });

    setPending(false);

    if (!result.ok) {
      setFormError(result.error);
      if (result.fields) {
        setFields(Object.fromEntries(Object.entries(result.fields).map(([k, v]) => [k.replace(/^data\./, ""), v])));
      }
      return;
    }

    toast(editing ? "Category updated" : "Category created", "success");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={formError} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={fields.name} required>
          {(props) => (
            <input
              {...props}
              value={values.name}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  name: e.target.value,
                  slug: slugTouched ? v.slug : slugify(e.target.value),
                }))
              }
              required
              maxLength={80}
              placeholder="Kurtis"
              className="hf-input"
            />
          )}
        </Field>

        <Field
          label="URL slug"
          error={fields.slug}
          hint={`/${values.parentId ? `${parents.find((p) => p.id === values.parentId)?.slug ?? ""}/` : ""}${values.slug || "your-slug"}`}
          required
        >
          {(props) => (
            <input
              {...props}
              value={values.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setValues((v) => ({ ...v, slug: slugify(e.target.value) }));
              }}
              required
              maxLength={120}
              className="hf-input font-mono text-sm"
            />
          )}
        </Field>
      </div>

      <Field
        label="Description"
        error={fields.description}
        hint="Shown at the top of the category page. Good place for keyword-rich copy."
      >
        {(props) => (
          <textarea
            {...props}
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            rows={3}
            maxLength={1000}
            className="hf-input resize-y"
          />
        )}
      </Field>

      <ImageUploader
        label="Category image (home page and menu)"
        folder="categories"
        max={1}
        images={values.imageUrl ? [{ url: values.imageUrl, alt: "" }] : []}
        onChange={(images) =>
          setValues((v) => ({ ...v, imageUrl: images[0]?.url ?? "" }))
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Parent category" error={fields.parentId}>
          {(props) => (
            <select
              {...props}
              value={values.parentId}
              onChange={(e) => setValues((v) => ({ ...v, parentId: e.target.value }))}
              className="hf-input"
            >
              <option value="">None (top level)</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="HSN code (GST)" error={fields.hsnCodeId} hint="Used for every product in this category unless the product sets its own.">
          {(props) => (
            <select
              {...props}
              value={values.hsnCodeId}
              onChange={(e) => setValues((v) => ({ ...v, hsnCodeId: e.target.value }))}
              className="hf-input"
            >
              <option value="">None</option>
              {hsnCodes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.code} — {h.description}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="flex flex-col justify-end gap-2 pb-2">
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-cotton-400 accent-indigo-ink-800"
            />
            <span className="font-medium text-indigo-ink-900">Visible in the shop</span>
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={values.showInMenu}
              onChange={(e) => setValues((v) => ({ ...v, showInMenu: e.target.checked }))}
              className="h-4 w-4 rounded border-cotton-400 accent-indigo-ink-800"
            />
            <span className="font-medium text-indigo-ink-900">Show in the menu</span>
          </label>
        </div>
      </div>

      <ImageUploader
        label="Banner image (top of the category page)"
        folder="categories"
        max={1}
        images={values.bannerImageUrl ? [{ url: values.bannerImageUrl, alt: "" }] : []}
        onChange={(images) => setValues((v) => ({ ...v, bannerImageUrl: images[0]?.url ?? "" }))}
      />

      <details className="rounded-lg border border-cotton-300 bg-cotton-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-ink-900">
          Search engine settings
        </summary>
        <div className="mt-4 space-y-4">
          <Field
            label="Text at the bottom of the page"
            error={fields.bottomContent}
            hint="A few paragraphs about this category help Google rank the page. Shown below the products."
          >
            {(props) => (
              <textarea
                {...props}
                value={values.bottomContent}
                onChange={(e) => setValues((v) => ({ ...v, bottomContent: e.target.value }))}
                rows={6}
                maxLength={10000}
                className="hf-input resize-y"
              />
            )}
          </Field>

          <Field
            label="Meta title"
            error={fields.metaTitle}
            hint={`${values.metaTitle.length}/70 characters`}
          >
            {(props) => (
              <input
                {...props}
                value={values.metaTitle}
                onChange={(e) => setValues((v) => ({ ...v, metaTitle: e.target.value }))}
                maxLength={70}
                placeholder="Sanganeri Print Kurtis Online | Cotton Block Print Kurtis"
                className="hf-input"
              />
            )}
          </Field>

          <Field
            label="Meta description"
            error={fields.metaDescription}
            hint={`${values.metaDescription.length}/170 characters`}
          >
            {(props) => (
              <textarea
                {...props}
                value={values.metaDescription}
                onChange={(e) =>
                  setValues((v) => ({ ...v, metaDescription: e.target.value }))
                }
                rows={2}
                maxLength={170}
                className="hf-input resize-y"
              />
            )}
          </Field>
        </div>
      </details>

      <div className="flex gap-2.5">
        <button type="submit" disabled={pending} className="hf-btn hf-btn-primary px-8">
          {pending ? "Saving…" : editing ? "Save changes" : "Create category"}
        </button>
        <button type="button" onClick={onCancel} className="hf-btn hf-btn-outline">
          Cancel
        </button>
      </div>
    </form>
  );
}
