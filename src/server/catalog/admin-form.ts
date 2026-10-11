import "server-only";

import { db } from "@/lib/db";
import { getSettings } from "@/server/settings";
import type { AttributeOption, CategoryOption, HsnOption, ProductFormValues } from "@/components/admin/ProductForm";

const rupees = (paise: number | null | undefined) => (paise == null ? "" : String(paise / 100));

/** Dropdown data for the product editor. */
export async function productFormOptions(): Promise<{
  categories: CategoryOption[];
  hsnCodes: HsnOption[];
  attributes: AttributeOption[];
  wholesalePlusGst: boolean;
}> {
  const [categories, hsnCodes, attributes, settings] = await Promise.all([
    db.category.findMany({
      orderBy: [{ parentId: "asc" }, { position: "asc" }],
      select: { id: true, name: true, hsnCodeId: true, parent: { select: { name: true } } },
    }),
    db.hsnCode.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, description: true } }),
    db.attributeDefinition.findMany({
      orderBy: { position: "asc" },
      select: { id: true, label: true, type: true, unit: true, options: true, categoryId: true, isRequired: true },
    }),
    getSettings(),
  ]);
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name, parentName: c.parent?.name ?? null, hsnCodeId: c.hsnCodeId })),
    hsnCodes,
    attributes,
    wholesalePlusGst: !settings.tax.wholesalePricesIncludeTax,
  };
}

/** A saved product, shaped for the editor. */
export async function productFormValues(id: string): Promise<ProductFormValues | null> {
  const [product, tier] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        media: { orderBy: { position: "asc" } },
        variants: { where: { archivedAt: null }, orderBy: { position: "asc" } },
        attributeValues: { include: { attribute: { select: { type: true } } } },
        wholesalePrices: { orderBy: { minQuantity: "asc" } },
      },
    }),
    db.priceTier.findFirst({ where: { isDefault: true }, select: { id: true } }),
  ]);
  if (!product) return null;

  const attributes: Record<string, string | string[]> = {};
  for (const av of product.attributeValues) {
    if (av.attribute.type === "MULTI_SELECT") {
      const list = (attributes[av.attributeId] as string[] | undefined) ?? [];
      attributes[av.attributeId] = [...list, av.value];
    } else {
      attributes[av.attributeId] = av.value;
    }
  }

  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    shortDescription: product.shortDescription ?? "",
    description: product.description,
    categoryId: product.categoryId,
    status: product.status,
    publishAt: product.publishAt?.toISOString() ?? "",
    printTechnique: product.printTechnique,
    hsnCodeId: product.hsnCodeId ?? "",
    price: rupees(product.price),
    mrp: rupees(product.mrp),
    wholesaleEnabled: product.wholesaleEnabled,
    wholesaleMinQty: String(product.wholesaleMinQty),
    wholesalePrices: product.wholesalePrices
      .filter((w) => w.priceTierId === tier?.id)
      .map((w) => ({ minQuantity: String(w.minQuantity), unitPrice: rupees(w.unitPrice) })),
    weightGrams: product.weightGrams != null ? String(product.weightGrams) : "",
    careInstructions: product.careInstructions ?? "",
    isReturnable: product.isReturnable,
    isCodAllowed: product.isCodAllowed,
    isFeatured: product.isFeatured,
    isNewArrival: product.isNewArrival,
    metaTitle: product.metaTitle ?? "",
    metaDescription: product.metaDescription ?? "",
    searchKeywords: product.searchKeywords.join(", "),
    media: product.media.map((m) => ({ url: m.url, alt: m.alt })),
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size ?? "",
      colorName: v.colorName ?? "",
      colorHex: v.colorHex ?? "",
      packQuantity: String(v.packQuantity),
      label: v.label ?? "",
      price: rupees(v.price),
      mrp: rupees(v.mrp),
      stock: String(v.stock),
      lowStockThreshold: String(v.lowStockThreshold),
      isActive: v.isActive,
    })),
    attributes,
  };
}
