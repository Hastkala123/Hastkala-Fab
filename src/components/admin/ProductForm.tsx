"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { Field, FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { cn, slugify } from "@/lib/utils";
import ImageUploader, { type UploadedImage } from "./ImageUploader";

/**
 * Admin → Products → Add / Edit. One form for everything about a design:
 * details, photos, sizes and colours with stock, prices, wholesale tiers,
 * filter attributes, policies, visibility and SEO. Prices are typed in rupees.
 */

export type VariantRow = {
  id?: string;
  sku: string;
  size: string;
  colorName: string;
  colorHex: string;
  packQuantity: string;
  label: string;
  price: string;
  mrp: string;
  stock: string;
  lowStockThreshold: string;
  isActive: boolean;
};

export type ProductFormValues = {
  id?: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  publishAt: string;
  printTechnique: "HAND_BLOCK" | "SCREEN" | "DIGITAL" | "HAND_PAINTED" | "OTHER";
  hsnCodeId: string;
  price: string;
  mrp: string;
  wholesaleEnabled: boolean;
  wholesaleMinQty: string;
  wholesalePrices: { minQuantity: string; unitPrice: string }[];
  weightGrams: string;
  careInstructions: string;
  isReturnable: boolean;
  isCodAllowed: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  metaTitle: string;
  metaDescription: string;
  searchKeywords: string;
  media: UploadedImage[];
  variants: VariantRow[];
  attributes: Record<string, string | string[]>;
};

export type CategoryOption = { id: string; name: string; parentName: string | null; hsnCodeId: string | null };
export type HsnOption = { id: string; code: string; description: string };
export type AttributeOption = {
  id: string;
  label: string;
  type: "TEXT" | "NUMBER" | "SELECT" | "MULTI_SELECT" | "BOOLEAN";
  unit: string | null;
  options: string[];
  categoryId: string | null;
  isRequired: boolean;
};

export const emptyVariant = (sku = ""): VariantRow => ({
  sku,
  size: "",
  colorName: "",
  colorHex: "",
  packQuantity: "1",
  label: "",
  price: "",
  mrp: "",
  stock: "0",
  lowStockThreshold: "3",
  isActive: true,
});

export const emptyProduct: ProductFormValues = {
  title: "",
  slug: "",
  shortDescription: "",
  description: "",
  categoryId: "",
  status: "DRAFT",
  publishAt: "",
  printTechnique: "HAND_BLOCK",
  hsnCodeId: "",
  price: "",
  mrp: "",
  wholesaleEnabled: false,
  wholesaleMinQty: "10",
  wholesalePrices: [],
  weightGrams: "",
  careInstructions: "Hand wash separately in cold water. Do not bleach. Dry in shade.",
  isReturnable: true,
  isCodAllowed: true,
  isFeatured: false,
  isNewArrival: true,
  metaTitle: "",
  metaDescription: "",
  searchKeywords: "",
  media: [],
  variants: [emptyVariant()],
  attributes: {},
};

const PRINT_TECHNIQUES = [
  { value: "HAND_BLOCK", label: "Hand block print" },
  { value: "SCREEN", label: "Screen print" },
  { value: "DIGITAL", label: "Digital print" },
  { value: "HAND_PAINTED", label: "Hand painted" },
  { value: "OTHER", label: "Other" },
] as const;

const skuPart = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);

/** "2026-10-12T10:00" from an ISO date, in the browser's own time zone. */
function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ProductForm({
  initial,
  categories,
  hsnCodes,
  attributes,
  wholesalePlusGst,
}: {
  initial: ProductFormValues;
  categories: CategoryOption[];
  hsnCodes: HsnOption[];
  attributes: AttributeOption[];
  wholesalePlusGst: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<ProductFormValues>(initial);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const [quickSizes, setQuickSizes] = useState("S, M, L, XL, XXL");
  const editing = Boolean(initial.id);

  const category = categories.find((c) => c.id === values.categoryId);
  const categoryHsn = hsnCodes.find((h) => h.id === category?.hsnCodeId);
  const applicableAttributes = useMemo(
    () => attributes.filter((a) => a.categoryId === null || a.categoryId === values.categoryId),
    [attributes, values.categoryId],
  );
  const skuBase = skuPart(values.slug.split("-").slice(0, 3).join("-")) || "SKU";

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function setVariant(index: number, patch: Partial<VariantRow>) {
    setValues((v) => ({ ...v, variants: v.variants.map((row, i) => (i === index ? { ...row, ...patch } : row)) }));
  }

  function setAttribute(id: string, value: string | string[]) {
    setValues((v) => ({ ...v, attributes: { ...v.attributes, [id]: value } }));
  }

  function onTitleChange(title: string) {
    setValues((v) => ({
      ...v,
      title,
      // The web address follows the name until edited by hand — changing a
      // live product's address later loses its search ranking.
      slug: slugTouched ? v.slug : slugify(title),
    }));
  }

  /** Adds one row per size for the colour in the first row (or none). */
  function addSizes() {
    const sizes = quickSizes
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (sizes.length === 0) return;
    setValues((v) => {
      const template = v.variants.find((row) => row.colorName) ?? v.variants[0] ?? emptyVariant();
      const existing = new Set(v.variants.map((row) => `${row.size}|${row.colorName}`));
      const rows = sizes
        .filter((size) => !existing.has(`${size}|${template.colorName}`))
        .map((size) => ({
          ...emptyVariant(),
          size,
          colorName: template.colorName,
          colorHex: template.colorHex,
          sku: [skuBase, skuPart(template.colorName), size].filter(Boolean).join("-"),
        }));
      // Replace a single blank starter row instead of keeping it.
      const keep = v.variants.filter((row) => row.id || row.size || row.colorName || Number(row.stock) > 0);
      return { ...v, variants: [...keep, ...rows] };
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setFormError(null);
    setFields({});

    const payload = {
      title: values.title,
      slug: values.slug,
      shortDescription: values.shortDescription,
      description: values.description,
      categoryId: values.categoryId,
      status: values.status,
      publishAt: values.publishAt ? new Date(values.publishAt).toISOString() : "",
      printTechnique: values.printTechnique,
      hsnCodeId: values.hsnCodeId,
      price: values.price,
      mrp: values.mrp,
      wholesaleEnabled: values.wholesaleEnabled,
      wholesaleMinQty: values.wholesaleMinQty,
      wholesalePrices: values.wholesaleEnabled ? values.wholesalePrices : [],
      weightGrams: values.weightGrams,
      careInstructions: values.careInstructions,
      isReturnable: values.isReturnable,
      isCodAllowed: values.isCodAllowed,
      isFeatured: values.isFeatured,
      isNewArrival: values.isNewArrival,
      metaTitle: values.metaTitle,
      metaDescription: values.metaDescription,
      searchKeywords: values.searchKeywords,
      media: values.media,
      variants: values.variants.map((row) => ({ ...row, sku: row.sku || [skuBase, skuPart(row.size), skuPart(row.colorName)].filter(Boolean).join("-") })),
      attributes: Object.fromEntries(
        Object.entries(values.attributes).filter(([id]) => applicableAttributes.some((a) => a.id === id)),
      ),
    };

    const result = await apiRequest<{ product: { id: string } }>("/api/admin/products", {
      method: editing ? "PATCH" : "POST",
      body: editing ? { id: initial.id, data: payload } : payload,
    });
    setPending(false);

    if (!result.ok) {
      setFormError(result.error);
      // Edits are sent as { id, data }, so field paths arrive as "data.title".
      if (result.fields) {
        setFields(Object.fromEntries(Object.entries(result.fields).map(([k, v]) => [k.replace(/^data\./, ""), v])));
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    toast(editing ? "Product saved" : "Product created", "success");
    if (editing) router.refresh();
    else router.push(`/admin/products/${result.data.product.id}`);
  }

  // Zod paths like "variants.2.sku" become field keys; show the first per row.
  const variantError = (index: number) =>
    Object.entries(fields).find(([key]) => key.startsWith(`variants.${index}.`))?.[1];

  return (
    <form onSubmit={onSubmit} className="space-y-6 pb-28" noValidate>
      <FormError message={formError} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="hf-card p-5">
            <h2 className="font-display text-base font-bold text-indigo-ink-950">Product details</h2>
            <div className="mt-4 space-y-4">
              <Field label="Name" error={fields.title} required>
                {(props) => (
                  <input
                    {...props}
                    value={values.title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    maxLength={160}
                    placeholder="Indigo Buti Hand Block Cotton Straight Kurti"
                    className="hf-input"
                  />
                )}
              </Field>

              <Field label="Web address" error={fields.slug} hint={`/products/${values.slug || "your-product"}`} required>
                {(props) => (
                  <input
                    {...props}
                    value={values.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      set("slug", slugify(e.target.value));
                    }}
                    maxLength={120}
                    className="hf-input font-mono text-sm"
                  />
                )}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category" error={fields.categoryId} required>
                  {(props) => (
                    <select {...props} value={values.categoryId} onChange={(e) => set("categoryId", e.target.value)} className="hf-input">
                      <option value="">Choose…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.parentName ? `${c.parentName} › ${c.name}` : c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Print" error={fields.printTechnique} required>
                  {(props) => (
                    <select
                      {...props}
                      value={values.printTechnique}
                      onChange={(e) => set("printTechnique", e.target.value as ProductFormValues["printTechnique"])}
                      className="hf-input"
                    >
                      {PRINT_TECHNIQUES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>

              <Field label="Short description" error={fields.shortDescription} hint="One line under the name, also used by Google.">
                {(props) => (
                  <input
                    {...props}
                    value={values.shortDescription}
                    onChange={(e) => set("shortDescription", e.target.value)}
                    maxLength={300}
                    placeholder="Classic indigo buti on breathable cotton."
                    className="hf-input"
                  />
                )}
              </Field>

              <Field label="Full description" error={fields.description} hint="Leave a blank line between paragraphs." required>
                {(props) => (
                  <textarea
                    {...props}
                    value={values.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows={8}
                    maxLength={10_000}
                    className="hf-input resize-y"
                  />
                )}
              </Field>
            </div>
          </section>

          <section className="hf-card p-5">
            <ImageUploader images={values.media} onChange={(media) => set("media", media)} />
            {fields.media && <p className="mt-2 text-xs font-medium text-madder-600">{fields.media}</p>}
          </section>

          <section className="hf-card p-5">
            <h2 className="font-display text-base font-bold text-indigo-ink-950">Price</h2>
            <p className="mt-1 text-xs text-slate-500">In rupees, including GST. A size or colour can have its own price below.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Selling price (₹)" error={fields.price} required>
                {(props) => (
                  <input {...props} type="number" inputMode="decimal" min={0} step="0.01" value={values.price}
                    onChange={(e) => set("price", e.target.value)} placeholder="1299" className="hf-input" />
                )}
              </Field>
              <Field label="MRP (₹)" error={fields.mrp} required>
                {(props) => (
                  <input {...props} type="number" inputMode="decimal" min={0} step="0.01" value={values.mrp}
                    onChange={(e) => set("mrp", e.target.value)} placeholder="1899" className="hf-input" />
                )}
              </Field>
              <Field
                label="HSN code (GST)"
                error={fields.hsnCodeId}
                hint={categoryHsn ? `Category default: ${categoryHsn.code}` : "Set one on the category to apply to all its products."}
              >
                {(props) => (
                  <select {...props} value={values.hsnCodeId} onChange={(e) => set("hsnCodeId", e.target.value)} className="hf-input">
                    <option value="">Use category&apos;s</option>
                    {hsnCodes.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.code} — {h.description}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </section>

          <section className="hf-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-indigo-ink-950">Sizes, colours &amp; stock</h2>
                <p className="mt-1 text-xs text-slate-500">
                  One row per size/colour. Stock changes are recorded in the stock history. Removed rows are archived, not deleted.
                </p>
              </div>
              <div className="flex items-end gap-2">
                <label className="text-xs text-slate-600">
                  <span className="mb-1 block font-semibold">Quick add sizes</span>
                  <input value={quickSizes} onChange={(e) => setQuickSizes(e.target.value)} className="hf-input w-44 py-1.5 text-sm" />
                </label>
                <button type="button" onClick={addSizes} className="hf-btn hf-btn-outline py-1.5 text-sm">
                  Add
                </button>
              </div>
            </div>
            {fields.variants && <p className="mt-2 text-xs font-medium text-madder-600">{fields.variants}</p>}

            <div className="mt-4 space-y-3">
              {values.variants.map((row, index) => (
                <div
                  key={row.id ?? `new-${index}`}
                  className={cn("rounded-lg border p-3", row.isActive ? "border-cotton-300" : "border-dashed border-cotton-400 bg-cotton-50")}
                >
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
                    <MiniInput label="Size" value={row.size} onChange={(size) => setVariant(index, { size })} placeholder="M" />
                    <MiniInput label="Colour" value={row.colorName} onChange={(colorName) => setVariant(index, { colorName })} placeholder="Indigo" />
                    <label className="text-xs text-slate-600">
                      <span className="mb-1 block font-semibold">Swatch</span>
                      <input
                        type="color"
                        value={row.colorHex || "#1f3a5f"}
                        onChange={(e) => setVariant(index, { colorHex: e.target.value })}
                        className="h-9 w-full cursor-pointer rounded border border-cotton-300"
                        aria-label={`Swatch colour for row ${index + 1}`}
                      />
                    </label>
                    <MiniInput label="SKU" value={row.sku} onChange={(sku) => setVariant(index, { sku: sku.toUpperCase() })} placeholder="AUTO" mono />
                    <MiniInput label="Stock" type="number" value={row.stock} onChange={(stock) => setVariant(index, { stock })} />
                    <MiniInput label="Price ₹ (opt.)" type="number" value={row.price} onChange={(price) => setVariant(index, { price })} placeholder={values.price || "—"} />
                    <MiniInput label="MRP ₹ (opt.)" type="number" value={row.mrp} onChange={(mrp) => setVariant(index, { mrp })} placeholder={values.mrp || "—"} />
                    <MiniInput label="Alert at" type="number" value={row.lowStockThreshold} onChange={(lowStockThreshold) => setVariant(index, { lowStockThreshold })} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                    <MiniInput label="Name (opt.)" value={row.label} onChange={(label) => setVariant(index, { label })} placeholder="e.g. Double bed" inline />
                    <MiniInput label="Pieces in pack" type="number" value={row.packQuantity} onChange={(packQuantity) => setVariant(index, { packQuantity })} inline />
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={row.isActive} onChange={(e) => setVariant(index, { isActive: e.target.checked })} className="accent-indigo-ink-800" />
                      On sale
                    </label>
                    <button
                      type="button"
                      onClick={() => setValues((v) => ({ ...v, variants: v.variants.filter((_, i) => i !== index) }))}
                      disabled={values.variants.length === 1}
                      className="ml-auto font-semibold text-madder-600 disabled:opacity-30"
                    >
                      Remove
                    </button>
                  </div>
                  {variantError(index) && <p className="mt-1.5 text-xs font-medium text-madder-600">{variantError(index)}</p>}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setValues((v) => ({ ...v, variants: [...v.variants, emptyVariant()] }))}
              className="hf-btn hf-btn-outline mt-3 py-1.5 text-sm"
            >
              + Add a row
            </button>
          </section>

          <section className="hf-card p-5">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="font-display text-base font-bold text-indigo-ink-950">Wholesale</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Approved trade buyers see these prices{wholesalePlusGst ? " (+ GST)" : " (GST included)"}.
                </span>
              </span>
              <input
                type="checkbox"
                checked={values.wholesaleEnabled}
                onChange={(e) => {
                  const on = e.target.checked;
                  setValues((v) => ({
                    ...v,
                    wholesaleEnabled: on,
                    wholesalePrices: on && v.wholesalePrices.length === 0 ? [{ minQuantity: v.wholesaleMinQty || "10", unitPrice: "" }] : v.wholesalePrices,
                  }));
                }}
                className="h-5 w-5 accent-indigo-ink-800"
              />
            </label>
            {values.wholesaleEnabled && (
              <div className="mt-4 space-y-3">
                <MiniInput
                  label="Minimum pieces for any wholesale price (sizes and colours combined)"
                  type="number"
                  value={values.wholesaleMinQty}
                  onChange={(wholesaleMinQty) => set("wholesaleMinQty", wholesaleMinQty)}
                />
                {fields.wholesalePrices && <p className="text-xs font-medium text-madder-600">{fields.wholesalePrices}</p>}
                {values.wholesalePrices.map((tier, index) => (
                  <div key={index} className="flex items-end gap-2.5">
                    <MiniInput
                      label="From pieces"
                      type="number"
                      value={tier.minQuantity}
                      onChange={(minQuantity) =>
                        setValues((v) => ({ ...v, wholesalePrices: v.wholesalePrices.map((t, i) => (i === index ? { ...t, minQuantity } : t)) }))
                      }
                    />
                    <MiniInput
                      label={`Price per piece ₹${wholesalePlusGst ? " (before GST)" : ""}`}
                      type="number"
                      value={tier.unitPrice}
                      onChange={(unitPrice) =>
                        setValues((v) => ({ ...v, wholesalePrices: v.wholesalePrices.map((t, i) => (i === index ? { ...t, unitPrice } : t)) }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setValues((v) => ({ ...v, wholesalePrices: v.wholesalePrices.filter((_, i) => i !== index) }))}
                      className="pb-2 text-xs font-semibold text-madder-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setValues((v) => ({ ...v, wholesalePrices: [...v.wholesalePrices, { minQuantity: "", unitPrice: "" }] }))}
                  className="hf-btn hf-btn-outline py-1.5 text-sm"
                >
                  + Add a price break
                </button>
              </div>
            )}
          </section>

          {applicableAttributes.length > 0 && (
            <section className="hf-card p-5">
              <h2 className="font-display text-base font-bold text-indigo-ink-950">Fabric, occasion &amp; more</h2>
              <p className="mt-1 text-xs text-slate-500">These show on the product page and power the shop filters.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {applicableAttributes.map((attribute) => (
                  <AttributeInput
                    key={attribute.id}
                    attribute={attribute}
                    value={values.attributes[attribute.id]}
                    onChange={(value) => setAttribute(attribute.id, value)}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="hf-card p-5">
            <h2 className="font-display text-base font-bold text-indigo-ink-950">Search engines (SEO)</h2>
            <div className="mt-4 space-y-4">
              <Field label="Page title" error={fields.metaTitle} hint={`${values.metaTitle.length}/70 · leave blank to use the product name`}>
                {(props) => (
                  <input {...props} value={values.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} maxLength={70} className="hf-input" />
                )}
              </Field>
              <Field label="Description" error={fields.metaDescription} hint={`${values.metaDescription.length}/170`}>
                {(props) => (
                  <textarea {...props} value={values.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} maxLength={170} rows={2} className="hf-input" />
                )}
              </Field>
              <Field
                label="Search words"
                error={fields.searchKeywords}
                hint="Comma separated — words shoppers type: jaipuri kurti, sanganeri print, cotton kurti for summer…"
              >
                {(props) => (
                  <textarea {...props} value={values.searchKeywords} onChange={(e) => set("searchKeywords", e.target.value)} rows={3} maxLength={2000} className="hf-input" />
                )}
              </Field>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="hf-card p-5">
            <h2 className="font-display text-base font-bold text-indigo-ink-950">Visibility</h2>
            <div className="mt-4 space-y-4">
              <Field label="Status" error={fields.status}>
                {(props) => (
                  <select {...props} value={values.status} onChange={(e) => set("status", e.target.value as ProductFormValues["status"])} className="hf-input">
                    <option value="DRAFT">Draft — hidden</option>
                    <option value="ACTIVE">Live in the shop</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                )}
              </Field>
              <Field label="Go live at (optional)" error={fields.publishAt} hint="A live product stays hidden until this time.">
                {(props) => (
                  <input
                    {...props}
                    type="datetime-local"
                    value={toLocalInput(values.publishAt)}
                    onChange={(e) => set("publishAt", e.target.value ? new Date(e.target.value).toISOString() : "")}
                    className="hf-input"
                  />
                )}
              </Field>
              <Toggle label="Featured on the home page" checked={values.isFeatured} onChange={(v) => set("isFeatured", v)} />
              <Toggle label="Show in New Arrivals" checked={values.isNewArrival} onChange={(v) => set("isNewArrival", v)} />
            </div>
          </section>

          <section className="hf-card p-5">
            <h2 className="font-display text-base font-bold text-indigo-ink-950">Delivery &amp; returns</h2>
            <div className="mt-4 space-y-4">
              <Toggle label="Can be returned" checked={values.isReturnable} onChange={(v) => set("isReturnable", v)} />
              <Toggle label="Cash on delivery allowed" checked={values.isCodAllowed} onChange={(v) => set("isCodAllowed", v)} />
              <Field label="Packed weight (grams)" error={fields.weightGrams} hint="Used for courier charges.">
                {(props) => (
                  <input {...props} type="number" inputMode="numeric" min={1} value={values.weightGrams} onChange={(e) => set("weightGrams", e.target.value)} className="hf-input" />
                )}
              </Field>
              <Field label="Care instructions" error={fields.careInstructions}>
                {(props) => (
                  <textarea {...props} value={values.careInstructions} onChange={(e) => set("careInstructions", e.target.value)} rows={3} maxLength={1000} className="hf-input" />
                )}
              </Field>
            </div>
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cotton-300 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-end gap-3">
          {formError && <p className="mr-auto text-sm font-medium text-madder-700">{formError}</p>}
          <button type="button" onClick={() => router.push("/admin/products")} className="hf-btn hf-btn-outline">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="hf-btn hf-btn-primary px-8">
            {pending ? "Saving…" : editing ? "Save changes" : "Create product"}
          </button>
        </div>
      </div>
    </form>
  );
}

function MiniInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  mono,
  inline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  placeholder?: string;
  mono?: boolean;
  inline?: boolean;
}) {
  return (
    <label className={cn("text-xs text-slate-600", inline && "flex items-center gap-2")}>
      <span className={cn("block font-semibold", !inline && "mb-1")}>{label}</span>
      <input
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        min={type === "number" ? 0 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("hf-input py-1.5 text-sm", mono && "font-mono", inline && "w-32")}
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-indigo-ink-800" />
    </label>
  );
}

function AttributeInput({
  attribute,
  value,
  onChange,
}: {
  attribute: AttributeOption;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  const label = `${attribute.label}${attribute.unit ? ` (${attribute.unit})` : ""}`;
  const single = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

  if (attribute.type === "MULTI_SELECT") {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    return (
      <fieldset className="sm:col-span-2">
        <legend className="hf-label">{label}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {attribute.options.map((option) => {
            const on = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? selected.filter((v) => v !== option) : [...selected, option])}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  on ? "border-indigo-ink-800 bg-indigo-ink-800 text-white" : "border-cotton-300 text-slate-700 hover:border-indigo-ink-400",
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  return (
    <label className="text-sm">
      <span className="hf-label">{label}</span>
      {attribute.type === "SELECT" || attribute.type === "BOOLEAN" ? (
        <select value={single} onChange={(e) => onChange(e.target.value)} className="hf-input mt-1">
          <option value="">—</option>
          {(attribute.type === "BOOLEAN" ? ["Yes", "No"] : attribute.options).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={attribute.type === "NUMBER" ? "number" : "text"}
          value={single}
          onChange={(e) => onChange(e.target.value)}
          maxLength={200}
          className="hf-input mt-1"
        />
      )}
    </label>
  );
}
