"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/client-api";
import { Field, FormError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { slugify } from "@/lib/utils";
import ImageUploader, { type UploadedImage } from "./ImageUploader";

export type ProductFormValues = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  shortDesc: string;
  categoryId: string;
  /** Rupees, as typed into the form. Converted to paise server-side. */
  priceRetail: string;
  mrp: string;
  priceWholesale: string;
  wholesaleMinQty: string;
  sku: string;
  stock: string;
  fabric: string;
  printType: string;
  workType: string;
  occasion: string;
  washCare: string;
  origin: string;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  images: UploadedImage[];
  variants: VariantRow[];
};

export type VariantRow = {
  size: string;
  color: string;
  sku: string;
  stock: string;
  priceDelta: string;
};

export const emptyProduct: ProductFormValues = {
  title: "",
  slug: "",
  description: "",
  shortDesc: "",
  categoryId: "",
  priceRetail: "",
  mrp: "",
  priceWholesale: "",
  wholesaleMinQty: "10",
  sku: "",
  stock: "0",
  fabric: "100% Cotton",
  printType: "Sanganeri Hand Block Print",
  workType: "Hand Block Print",
  occasion: "",
  washCare: "Hand wash separately in cold water. Do not bleach. Dry in shade.",
  origin: "Sanganer, Jaipur, Rajasthan",
  isActive: true,
  isFeatured: false,
  isNew: true,
  metaTitle: "",
  metaDescription: "",
  keywords: "",
  images: [],
  variants: [],
};

export default function ProductForm({
  initial,
  categories,
}: {
  initial: ProductFormValues;
  categories: { id: string; name: string; parentName: string | null }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<ProductFormValues>(initial);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));

  const editing = Boolean(initial.id);

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function onTitleChange(title: string) {
    setValues((v) => ({
      ...v,
      title,
      // Auto-generate the slug until the admin edits it by hand, then leave
      // it alone — changing a live product's URL breaks its search ranking.
      slug: slugTouched ? v.slug : slugify(title),
      metaTitle: v.metaTitle || "",
    }));
  }

  function addVariant() {
    setValues((v) => ({
      ...v,
      variants: [
        ...v.variants,
        { size: "", color: "", sku: `${v.sku || "SKU"}-${v.variants.length + 1}`, stock: "0", priceDelta: "0" },
      ],
    }));
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
      description: values.description,
      shortDesc: values.shortDesc,
      categoryId: values.categoryId,
      priceRetail: values.priceRetail,
      mrp: values.mrp,
      ...(values.priceWholesale ? { priceWholesale: values.priceWholesale } : {}),
      wholesaleMinQty: values.wholesaleMinQty,
      sku: values.sku,
      stock: values.stock,
      fabric: values.fabric,
      printType: values.printType,
      workType: values.workType,
      occasion: values.occasion,
      washCare: values.washCare,
      origin: values.origin,
      isActive: values.isActive,
      isFeatured: values.isFeatured,
      isNew: values.isNew,
      metaTitle: values.metaTitle,
      metaDescription: values.metaDescription,
      keywords: values.keywords,
      images: values.images,
      variants: values.variants.map((v) => ({
        size: v.size,
        color: v.color,
        sku: v.sku,
        stock: v.stock,
        priceDelta: v.priceDelta,
      })),
    };

    const result = await apiRequest<{ product?: { id: string } }>(
      "/api/admin/products",
      {
        method: editing ? "PATCH" : "POST",
        body: editing ? { id: initial.id, data: payload } : payload,
      },
    );

    setPending(false);

    if (!result.ok) {
      setFormError(result.error);
      if (result.fields) setFields(result.fields);
      // Scroll the first error into view — long forms otherwise hide it.
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    toast(editing ? "Product updated" : "Product created", "success");
    router.push("/admin/products");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 pb-24" noValidate>
      <FormError message={formError} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* ---------- Basics ---------- */}
          <section className="hf-card p-5">
            <h2 className="font-display text-base font-bold text-indigo-ink-950">
              Product details
            </h2>

            <div className="mt-4 space-y-4">
              <Field label="Title" error={fields.title} required>
                {(props) => (
                  <input
                    {...props}
                    value={values.title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    required
                    maxLength={160}
                    placeholder="Indigo Buti Hand Block Cotton Straight Kurti"
                    className="hf-input"
                  />
                )}
              </Field>

              <Field
                label="URL slug"
                error={fields.slug}
                hint={`Product will live at /product/${values.slug || "your-slug"}`}
                required
              >
                {(props) => (
                  <input
                    {...props}
                    value={values.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      set("slug", slugify(e.target.value));
                    }}
                    required
                    maxLength={120}
                    className="hf-input font-mono text-sm"
                  />
                )}
              </Field>

              <Field
                label="Short description"
                error={fields.shortDesc}
                hint="One line shown under the title and used as the meta description fallback."
              >
                {(props) => (
                  <input
                    {...props}
                    value={values.shortDesc}
                    onChange={(e) => set("shortDesc", e.target.value)}
                    maxLength={300}
                    placeholder="Classic indigo buti print on breathable 100% cotton."
                    className="hf-input"
                  />
                )}
              </Field>

              <Field
                label="Full description"
                error={fields.description}
                hint="Separate paragraphs with a blank line. Minimum 20 characters."
                required
              >
                {(props) => (
                  <textarea
                    {...props}
                    value={values.description}
                    onChange={(e) => set("description", e.target.value)}
                    required
                    rows={8}
                    maxLength={8000}
                    className="hf-input resize-y"
                  />
                )}
              </Field>
            </div>
          </section>

          {/* ---------- Images ---------- */}
          <section className="hf-card p-5">
            <ImageUploader
              images={values.images}
              onChange={(images) => set("images", images)}
            />
          </section>

          {/* ---------- Pricing ---------- */}
          <section className="hf-card p-5">
            <h2 className="font-display text-base font-bold text-indigo-ink-950">
              Pricing &amp; inventory
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Enter prices in rupees. MRP must be greater than or equal to the
              selling price.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Selling price (₹)" error={fields.priceRetail} required>
                {(props) => (
                  <input
                    {...props}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={values.priceRetail}
                    onChange={(e) => set("priceRetail", e.target.value)}
                    required
                    placeholder="1299"
                    className="hf-input"
                  />
                )}
              </Field>

              <Field label="MRP (₹)" error={fields.mrp} required>
                {(props) => (
                  <input
                    {...props}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={values.mrp}
                    onChange={(e) => set("mrp", e.target.value)}
                    required
                    placeholder="1899"
                    className="hf-input"
                  />
                )}
              </Field>

              <Field
                label="Wholesale price (₹)"
                error={fields.priceWholesale}
                hint="Leave blank if not sold wholesale."
              >
                {(props) => (
                  <input
                    {...props}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={values.priceWholesale}
                    onChange={(e) => set("priceWholesale", e.target.value)}
                    placeholder="749"
                    className="hf-input"
                  />
                )}
              </Field>

              <Field label="Wholesale MOQ" error={fields.wholesaleMinQty}>
                {(props) => (
                  <input
                    {...props}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={values.wholesaleMinQty}
                    onChange={(e) => set("wholesaleMinQty", e.target.value)}
                    className="hf-input"
                  />
                )}
              </Field>

              <Field label="SKU" error={fields.sku} required>
                {(props) => (
                  <input
                    {...props}
                    value={values.sku}
                    onChange={(e) => set("sku", e.target.value.toUpperCase())}
                    required
                    maxLength={60}
                    placeholder="HF-KUR-IND-001"
                    className="hf-input font-mono text-sm"
                  />
                )}
              </Field>

              <Field
                label="Stock quantity"
                error={fields.stock}
                hint={
                  values.variants.length > 0
                    ? "With variants, this is the overall pool. Keep it at least as large as the sum of variant stock."
                    : undefined
                }
                required
              >
                {(props) => (
                  <input
                    {...props}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={values.stock}
                    onChange={(e) => set("stock", e.target.value)}
                    required
                    className="hf-input"
                  />
                )}
              </Field>
            </div>
          </section>

          {/* ---------- Variants ---------- */}
          <section className="hf-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-indigo-ink-950">
                  Variants
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Sizes or colours. Each needs its own unique SKU and stock.
                </p>
              </div>
              <button type="button" onClick={addVariant} className="hf-btn hf-btn-outline py-1.5 text-sm">
                + Add variant
              </button>
            </div>

            {values.variants.length === 0 ? (
              <p className="mt-4 rounded-lg bg-cotton-100 px-4 py-3 text-sm text-slate-500">
                No variants — the product will be sold as a single option using the
                stock above.
              </p>
            ) : (
              <div className="mt-4 space-y-2.5">
                {values.variants.map((variant, index) => (
                  <div
                    key={index}
                    className="grid gap-2 rounded-lg border border-cotton-300 bg-cotton-50 p-3 sm:grid-cols-[1fr_1fr_1.4fr_0.8fr_0.9fr_auto]"
                  >
                    <input
                      value={variant.size}
                      onChange={(e) => {
                        const next = [...values.variants];
                        next[index] = { ...next[index]!, size: e.target.value };
                        set("variants", next);
                      }}
                      placeholder="Size (M)"
                      maxLength={30}
                      aria-label={`Variant ${index + 1} size`}
                      className="hf-input py-1.5 text-sm"
                    />
                    <input
                      value={variant.color}
                      onChange={(e) => {
                        const next = [...values.variants];
                        next[index] = { ...next[index]!, color: e.target.value };
                        set("variants", next);
                      }}
                      placeholder="Colour"
                      maxLength={40}
                      aria-label={`Variant ${index + 1} colour`}
                      className="hf-input py-1.5 text-sm"
                    />
                    <input
                      value={variant.sku}
                      onChange={(e) => {
                        const next = [...values.variants];
                        next[index] = { ...next[index]!, sku: e.target.value.toUpperCase() };
                        set("variants", next);
                      }}
                      placeholder="SKU"
                      maxLength={60}
                      aria-label={`Variant ${index + 1} SKU`}
                      className="hf-input py-1.5 font-mono text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      value={variant.stock}
                      onChange={(e) => {
                        const next = [...values.variants];
                        next[index] = { ...next[index]!, stock: e.target.value };
                        set("variants", next);
                      }}
                      placeholder="Stock"
                      aria-label={`Variant ${index + 1} stock`}
                      className="hf-input py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={variant.priceDelta}
                      onChange={(e) => {
                        const next = [...values.variants];
                        next[index] = { ...next[index]!, priceDelta: e.target.value };
                        set("variants", next);
                      }}
                      placeholder="± ₹"
                      aria-label={`Variant ${index + 1} price adjustment`}
                      className="hf-input py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        set("variants", values.variants.filter((_, i) => i !== index))
                      }
                      className="rounded px-2 text-madder-600 transition hover:bg-madder-50"
                      aria-label={`Remove variant ${index + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ---------- SEO ---------- */}
          <section className="hf-card p-5">
            <h2 className="font-display text-base font-bold text-indigo-ink-950">
              Search engine listing
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              How this product appears in Google results. Leave blank to fall back
              to the title and short description.
            </p>

            {/* Live SERP preview — the fastest way to spot a truncated title. */}
            <div className="mt-4 rounded-lg border border-cotton-300 bg-white p-4">
              <p className="text-xs text-emerald-700">
                hastkalafab.com › product › {values.slug || "your-slug"}
              </p>
              <p className="mt-0.5 hf-clamp-1 text-base text-blue-800">
                {values.metaTitle || values.title || "Product title"}
              </p>
              <p className="hf-clamp-2 text-sm text-slate-600">
                {values.metaDescription ||
                  values.shortDesc ||
                  "Add a short description to control how this appears in search."}
              </p>
            </div>

            <div className="mt-4 space-y-4">
              <Field
                label="Meta title"
                error={fields.metaTitle}
                hint={`${values.metaTitle.length}/70 characters — Google truncates beyond about 60.`}
              >
                {(props) => (
                  <input
                    {...props}
                    value={values.metaTitle}
                    onChange={(e) => set("metaTitle", e.target.value)}
                    maxLength={70}
                    placeholder="Sanganeri Print Cotton Kurti | Hastkala Fab"
                    className="hf-input"
                  />
                )}
              </Field>

              <Field
                label="Meta description"
                error={fields.metaDescription}
                hint={`${values.metaDescription.length}/160 characters.`}
              >
                {(props) => (
                  <textarea
                    {...props}
                    value={values.metaDescription}
                    onChange={(e) => set("metaDescription", e.target.value)}
                    rows={2}
                    maxLength={160}
                    className="hf-input resize-y"
                  />
                )}
              </Field>

              <Field
                label="Keywords"
                error={fields.keywords}
                hint="Comma-separated. Use the phrases a customer would actually type."
              >
                {(props) => (
                  <input
                    {...props}
                    value={values.keywords}
                    onChange={(e) => set("keywords", e.target.value)}
                    maxLength={500}
                    placeholder="sanganeri kurti, cotton block print kurti, indigo kurti online"
                    className="hf-input"
                  />
                )}
              </Field>
            </div>
          </section>
        </div>

        {/* ---------- Sidebar ---------- */}
        <div className="space-y-6">
          <section className="hf-card p-5">
            <h2 className="font-display text-base font-bold text-indigo-ink-950">
              Visibility
            </h2>
            <div className="mt-3 space-y-2.5">
              <Toggle
                label="Live on the store"
                hint="Uncheck to hide without deleting."
                checked={values.isActive}
                onChange={(v) => set("isActive", v)}
              />
              <Toggle
                label="Featured on homepage"
                checked={values.isFeatured}
                onChange={(v) => set("isFeatured", v)}
              />
              <Toggle
                label="Show 'New' badge"
                checked={values.isNew}
                onChange={(v) => set("isNew", v)}
              />
            </div>
          </section>

          <section className="hf-card p-5">
            <Field label="Category" error={fields.categoryId} required>
              {(props) => (
                <select
                  {...props}
                  value={values.categoryId}
                  onChange={(e) => set("categoryId", e.target.value)}
                  required
                  className="hf-input"
                >
                  <option value="">Choose a category…</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.parentName
                        ? `${category.parentName} › ${category.name}`
                        : category.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {categories.length === 0 && (
              <p className="mt-2 text-xs text-madder-600">
                No categories exist yet.{" "}
                <Link href="/admin/categories" className="underline">
                  Create one first
                </Link>
                .
              </p>
            )}
          </section>

          <section className="hf-card p-5">
            <h2 className="font-display text-base font-bold text-indigo-ink-950">
              Product attributes
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              These power the storefront filters and long-tail search traffic.
            </p>

            <div className="mt-4 space-y-4">
              <Field label="Fabric" error={fields.fabric}>
                {(props) => (
                  <input
                    {...props}
                    value={values.fabric}
                    onChange={(e) => set("fabric", e.target.value)}
                    maxLength={60}
                    placeholder="100% Cotton"
                    className="hf-input"
                  />
                )}
              </Field>

              <Field label="Print type" error={fields.printType}>
                {(props) => (
                  <input
                    {...props}
                    value={values.printType}
                    onChange={(e) => set("printType", e.target.value)}
                    maxLength={60}
                    className="hf-input"
                  />
                )}
              </Field>

              <Field label="Work type" error={fields.workType}>
                {(props) => (
                  <input
                    {...props}
                    value={values.workType}
                    onChange={(e) => set("workType", e.target.value)}
                    maxLength={60}
                    className="hf-input"
                  />
                )}
              </Field>

              <Field
                label="Occasion"
                error={fields.occasion}
                hint="Comma-separated, e.g. Daily Wear, Office"
              >
                {(props) => (
                  <input
                    {...props}
                    value={values.occasion}
                    onChange={(e) => set("occasion", e.target.value)}
                    maxLength={60}
                    className="hf-input"
                  />
                )}
              </Field>

              <Field label="Wash care" error={fields.washCare}>
                {(props) => (
                  <textarea
                    {...props}
                    value={values.washCare}
                    onChange={(e) => set("washCare", e.target.value)}
                    rows={3}
                    maxLength={300}
                    className="hf-input resize-y"
                  />
                )}
              </Field>

              <Field
                label="Origin"
                error={fields.origin}
                hint="Shown on the product page as a mandatory country-of-origin disclosure."
              >
                {(props) => (
                  <input
                    {...props}
                    value={values.origin}
                    onChange={(e) => set("origin", e.target.value)}
                    maxLength={120}
                    className="hf-input"
                  />
                )}
              </Field>
            </div>
          </section>
        </div>
      </div>

      {/* Sticky action bar — a long form should never make you hunt for Save. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cotton-300 bg-cotton-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin/products" className="hf-btn hf-btn-ghost">
            Cancel
          </Link>
          <button type="submit" disabled={pending} className="hf-btn hf-btn-primary px-8">
            {pending
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create product"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-cotton-400 accent-indigo-ink-800"
      />
      <span>
        <span className="block text-sm font-medium text-indigo-ink-900">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}
