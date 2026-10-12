import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { variantLabel } from "@/lib/variants";
import { descendantIds, getCategories, liveProductWhere } from "@/server/catalog/products";
import { tierPricesFor, wholesaleMinimum, type Viewer } from "@/server/catalog/pricing";

/**
 * Designs offered wholesale, with each size/colour and the viewer's trade
 * prices. Feeds the quick-order grid, the printable line sheet, the price
 * list download and the public /wholesale pages (which show no prices).
 */

export type WholesaleDesign = {
  id: string;
  title: string;
  slug: string;
  categoryName: string;
  categoryId: string;
  image: { url: string; alt: string } | null;
  retailPrice: number;
  minQuantity: number | null;
  prices: { minQuantity: number; unitPrice: number }[];
  variants: { id: string; sku: string; label: string; stock: number }[];
};

export async function wholesaleDesigns(
  viewer: Viewer,
  options: { categorySlug?: string | null; take?: number } = {},
): Promise<WholesaleDesign[]> {
  const where: Prisma.ProductWhereInput = { AND: [liveProductWhere(), { wholesaleEnabled: true }] };
  if (options.categorySlug) {
    const all = await getCategories();
    const root = all.find((c) => c.slug === options.categorySlug);
    if (!root) return [];
    (where.AND as Prisma.ProductWhereInput[]).push({ categoryId: { in: descendantIds(all, root.id) } });
  }

  const products = await db.product.findMany({
    where,
    orderBy: [{ category: { position: "asc" } }, { position: "asc" }, { createdAt: "desc" }],
    take: options.take ?? 500,
    select: {
      id: true,
      title: true,
      slug: true,
      price: true,
      wholesaleMinQty: true,
      category: { select: { id: true, name: true } },
      media: { where: { type: "IMAGE" }, orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } },
      variants: {
        where: { isActive: true, archivedAt: null },
        orderBy: { position: "asc" },
        select: { id: true, sku: true, size: true, colorName: true, packQuantity: true, label: true, stock: true },
      },
      wholesalePrices: {
        where: { priceTierId: { in: [viewer.priceTierId, viewer.defaultTierId].filter((id): id is string => Boolean(id)) } },
        select: { priceTierId: true, minQuantity: true, unitPrice: true },
      },
    },
  });

  return products.map((p) => {
    const prices = tierPricesFor(p.wholesalePrices, viewer).map(({ minQuantity, unitPrice }) => ({ minQuantity, unitPrice }));
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      categoryName: p.category.name,
      categoryId: p.category.id,
      image: p.media[0] ? { url: p.media[0].url, alt: p.media[0].alt ?? p.title } : null,
      retailPrice: p.price,
      minQuantity: viewer.wholesale ? wholesaleMinimum(p, prices) : p.wholesaleMinQty,
      prices,
      variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, label: variantLabel(v) ?? "One size", stock: v.stock })),
    };
  });
}

/** Categories that have at least one wholesale design, for the /wholesale pages. */
export async function wholesaleCategories() {
  const [all, counts] = await Promise.all([
    getCategories(),
    db.product.groupBy({
      by: ["categoryId"],
      where: { AND: [liveProductWhere(), { wholesaleEnabled: true }] },
      _count: { id: true },
    }),
  ]);
  const direct = new Map(counts.map((c) => [c.categoryId, c._count.id]));
  return all
    .filter((c) => c.parentId === null)
    .map((c) => ({
      ...c,
      designs: descendantIds(all, c.id).reduce((sum, id) => sum + (direct.get(id) ?? 0), 0),
    }))
    .filter((c) => c.designs > 0);
}
