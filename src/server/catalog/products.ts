import "server-only";

import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettings } from "@/server/settings";
import { retailPrice, tierPricesFor, viewerTierIds, wholesaleFromPrice, type Viewer } from "./pricing";
import { searchProductIds } from "./search";

export const PAGE_SIZE = 24;

export const SORTS = ["recommended", "newest", "price-asc", "price-desc", "popular"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABELS: Record<Sort, string> = {
  recommended: "Recommended",
  newest: "Newest first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  popular: "Best selling",
};

/** Products a shopper may see: active, published, in an active category. */
export function liveProductWhere(now = new Date()): Prisma.ProductWhereInput {
  return {
    status: "ACTIVE",
    OR: [{ publishAt: null }, { publishAt: { lte: now } }],
    category: { isActive: true },
  };
}


function cardSelect(viewer: Viewer) {
  return {
    id: true,
    title: true,
    slug: true,
    price: true,
    mrp: true,
    isNewArrival: true,
    ratingAvg: true,
    ratingCount: true,
    wholesaleEnabled: true,
    wholesaleMinQty: true,
    category: { select: { name: true, slug: true } },
    media: {
      where: { type: "IMAGE" },
      orderBy: { position: "asc" },
      take: 2,
      select: { url: true, alt: true },
    },
    variants: {
      where: { isActive: true, archivedAt: null },
      select: { stock: true, price: true, mrp: true },
    },
    wholesalePrices: {
      where: { priceTierId: { in: viewerTierIds(viewer) } },
      select: { priceTierId: true, minQuantity: true, unitPrice: true },
    },
  } satisfies Prisma.ProductSelect;
}

type CardRow = Prisma.ProductGetPayload<{ select: ReturnType<typeof cardSelect> }>;

export type ProductCardData = {
  id: string;
  title: string;
  slug: string;
  categoryName: string;
  price: number;
  mrp: number;
  image: { url: string; alt: string } | null;
  hoverImage: { url: string; alt: string } | null;
  inStock: boolean;
  isNew: boolean;
  /** Only when there are real, approved reviews. */
  rating: { average: number; count: number } | null;
  /** Trade price for approved wholesale buyers. */
  wholesale: { unitPrice: number; minQuantity: number; plusGst: boolean } | null;
};

function toCard(row: CardRow, wholesalePlusGst: boolean): ProductCardData {
  const prices = row.variants.length
    ? row.variants.map((v) => retailPrice(row, v))
    : [retailPrice(row)];
  const cheapest = prices.reduce((low, p) => (p.price < low.price ? p : low));
  const from = row.wholesaleEnabled ? wholesaleFromPrice(row.wholesalePrices) : null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    categoryName: row.category.name,
    price: cheapest.price,
    mrp: cheapest.mrp,
    image: row.media[0] ?? null,
    hoverImage: row.media[1] ?? null,
    inStock: row.variants.some((v) => v.stock > 0),
    isNew: row.isNewArrival,
    rating: row.ratingCount > 0 ? { average: row.ratingAvg, count: row.ratingCount } : null,
    wholesale: from
      ? {
          unitPrice: from.unitPrice,
          minQuantity: Math.max(from.minQuantity, row.wholesaleMinQty),
          plusGst: wholesalePlusGst,
        }
      : null,
  };
}

async function cards(where: Prisma.ProductWhereInput, viewer: Viewer, args: {
  orderBy?: Prisma.ProductOrderByWithRelationInput[];
  take?: number;
  skip?: number;
}): Promise<ProductCardData[]> {
  const [rows, settings] = await Promise.all([
    db.product.findMany({ where, select: cardSelect(viewer), ...args }),
    getSettings(),
  ]);
  return rows.map((row) =>
    toCard({ ...row, wholesalePrices: tierPricesFor(row.wholesalePrices, viewer) }, !settings.tax.wholesalePricesIncludeTax),
  );
}

/** Cards for specific products, kept in the given order. */
export async function cardsByIds(ids: string[], viewer: Viewer): Promise<ProductCardData[]> {
  if (ids.length === 0) return [];
  const list = await cards({ AND: [liveProductWhere(), { id: { in: ids } }] }, viewer, {});
  const index = new Map(ids.map((id, i) => [id, i]));
  return list.sort((a, b) => index.get(a.id)! - index.get(b.id)!);
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export type ListingQuery = {
  categoryIds?: string[];
  collectionId?: string;
  q?: string;
  /** Paise. */
  minPrice?: number;
  maxPrice?: number;
  /** Attribute key → accepted values. */
  attrs?: Record<string, string[]>;
  sizes?: string[];
  colors?: string[];
  inStock?: boolean;
  sort: Sort;
  page: number;
};

const ORDER_BY: Record<Exclude<Sort, "recommended">, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }],
  "price-asc": [{ price: "asc" }, { position: "asc" }],
  "price-desc": [{ price: "desc" }, { position: "asc" }],
  popular: [{ soldCount: "desc" }, { position: "asc" }],
};
/** Recommended = the order the owner arranged in admin. */
const RECOMMENDED: Prisma.ProductOrderByWithRelationInput[] = [{ position: "asc" }, { createdAt: "desc" }];

/** The part of the filter that facets are counted against. */
function baseWhere(query: ListingQuery, searchIds: string[] | null): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [liveProductWhere()];
  if (query.categoryIds?.length) and.push({ categoryId: { in: query.categoryIds } });
  if (query.collectionId) and.push({ collections: { some: { collectionId: query.collectionId } } });
  if (searchIds) and.push({ id: { in: searchIds } });
  return { AND: and };
}

function filteredWhere(query: ListingQuery, base: Prisma.ProductWhereInput): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [base];
  if (query.minPrice != null || query.maxPrice != null) {
    and.push({ price: { gte: query.minPrice ?? undefined, lte: query.maxPrice ?? undefined } });
  }
  for (const [key, values] of Object.entries(query.attrs ?? {})) {
    if (values.length) {
      and.push({ attributeValues: { some: { attribute: { key }, value: { in: values } } } });
    }
  }
  const variantFilter: Prisma.ProductVariantWhereInput = { isActive: true, archivedAt: null };
  if (query.sizes?.length) variantFilter.size = { in: query.sizes };
  if (query.colors?.length) variantFilter.colorName = { in: query.colors };
  if (query.inStock) variantFilter.stock = { gt: 0 };
  if (query.sizes?.length || query.colors?.length || query.inStock) {
    and.push({ variants: { some: variantFilter } });
  }
  return { AND: and };
}

export type Listing = {
  products: ProductCardData[];
  total: number;
  page: number;
  totalPages: number;
  facets: Facets;
};

export async function listProducts(query: ListingQuery, viewer: Viewer): Promise<Listing> {
  const searchIds = query.q ? await searchProductIds(query.q) : null;
  const base = baseWhere(query, searchIds);
  const where = filteredWhere(query, base);
  const page = Math.max(1, query.page);
  const skip = (page - 1) * PAGE_SIZE;

  let products: ProductCardData[];
  let total: number;

  if (searchIds && query.sort === "recommended") {
    // Relevance order comes from the search query; apply filters, keep that order.
    const matching = await db.product.findMany({ where, select: { id: true } });
    const allowed = new Set(matching.map((m) => m.id));
    const ordered = searchIds.filter((id) => allowed.has(id));
    total = ordered.length;
    products = await cardsByIds(ordered.slice(skip, skip + PAGE_SIZE), viewer);
  } else {
    const orderBy = query.sort === "recommended" ? RECOMMENDED : ORDER_BY[query.sort];
    [products, total] = await Promise.all([
      cards(where, viewer, { orderBy, skip, take: PAGE_SIZE }),
      db.product.count({ where }),
    ]);
  }

  const facets = await getFacets(base, query.categoryIds ?? []);
  return { products, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), facets };
}

// ---------------------------------------------------------------------------
// Facets (filter sidebar) — built from the attributes the owner marks
// "filterable" in admin, so new filters need no code.
// ---------------------------------------------------------------------------

export type FacetOption = { value: string; count: number; hex?: string | null };
export type Facets = {
  attributes: { key: string; label: string; options: FacetOption[] }[];
  sizes: FacetOption[];
  colors: FacetOption[];
  price: { min: number; max: number };
};

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "4XL", "5XL", "6XL", "FREE"];
function sizeRank(size: string): number {
  const i = SIZE_ORDER.indexOf(size.toUpperCase());
  return i === -1 ? 100 : i;
}

export async function getFacets(base: Prisma.ProductWhereInput, categoryIds: string[]): Promise<Facets> {
  const definitions = await db.attributeDefinition.findMany({
    where: {
      isFilterable: true,
      OR: [{ categoryId: null }, ...(categoryIds.length ? [{ categoryId: { in: categoryIds } }] : [])],
    },
    orderBy: { position: "asc" },
    select: { id: true, key: true, label: true, options: true },
  });

  const variantWhere: Prisma.ProductVariantWhereInput = { isActive: true, archivedAt: null, product: base };

  const [values, sizes, colors, price] = await Promise.all([
    definitions.length
      ? db.productAttributeValue.groupBy({
          by: ["attributeId", "value"],
          where: { attributeId: { in: definitions.map((d) => d.id) }, product: base },
          _count: { productId: true },
        })
      : Promise.resolve([]),
    db.productVariant.groupBy({
      by: ["size"],
      where: { ...variantWhere, size: { not: null } },
      _count: { productId: true },
    }),
    db.productVariant.groupBy({
      by: ["colorName", "colorHex"],
      where: { ...variantWhere, colorName: { not: null } },
      _count: { productId: true },
    }),
    db.product.aggregate({ where: base, _min: { price: true }, _max: { price: true } }),
  ]);

  const attributes = definitions
    .map((def) => {
      const options = values
        .filter((v) => v.attributeId === def.id)
        .map((v) => ({ value: v.value, count: v._count.productId }));
      // Keep the owner's option order where one exists.
      const rank = (value: string) => {
        const i = def.options.indexOf(value);
        return i === -1 ? Number.MAX_SAFE_INTEGER : i;
      };
      options.sort((a, b) => rank(a.value) - rank(b.value) || a.value.localeCompare(b.value));
      return { key: def.key, label: def.label, options };
    })
    .filter((a) => a.options.length > 1 || (a.options.length === 1 && a.options[0]!.count > 0));

  const colorMap = new Map<string, FacetOption>();
  for (const c of colors) {
    const existing = colorMap.get(c.colorName!);
    if (existing) existing.count += c._count.productId;
    else colorMap.set(c.colorName!, { value: c.colorName!, count: c._count.productId, hex: c.colorHex });
  }

  return {
    attributes,
    sizes: sizes
      .map((s) => ({ value: s.size!, count: s._count.productId }))
      .sort((a, b) => sizeRank(a.value) - sizeRank(b.value) || a.value.localeCompare(b.value)),
    colors: [...colorMap.values()].sort((a, b) => a.value.localeCompare(b.value)),
    price: { min: price._min.price ?? 0, max: price._max.price ?? 0 },
  };
}

// ---------------------------------------------------------------------------
// Home page and related products
// ---------------------------------------------------------------------------

export async function featuredProducts(viewer: Viewer, take = 8): Promise<ProductCardData[]> {
  return cards({ AND: [liveProductWhere(), { isFeatured: true }] }, viewer, { orderBy: RECOMMENDED, take });
}

export async function newArrivals(viewer: Viewer, take = 8): Promise<ProductCardData[]> {
  return cards({ AND: [liveProductWhere(), { isNewArrival: true }] }, viewer, {
    orderBy: [{ createdAt: "desc" }],
    take,
  });
}

export async function relatedProducts(
  product: { id: string; categoryId: string },
  viewer: Viewer,
  take = 8,
): Promise<ProductCardData[]> {
  return cards(
    { AND: [liveProductWhere(), { categoryId: product.categoryId, id: { not: product.id } }] },
    viewer,
    { orderBy: RECOMMENDED, take },
  );
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl: string | null;
  showInMenu: boolean;
  position: number;
};

/** Every active category, in the owner's order. One query per request. */
export const getCategories = cache(async (): Promise<CategoryNode[]> => {
  return db.category.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, parentId: true, imageUrl: true, showInMenu: true, position: true },
  });
});

/** The id plus every descendant id, for "everything under Kurtis". */
export function descendantIds(all: CategoryNode[], rootId: string): string[] {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i++) {
    for (const c of all) if (c.parentId === ids[i]) ids.push(c.id);
  }
  return ids;
}

export async function getCategoryPage(slug: string) {
  const category = await db.category.findUnique({
    where: { slug },
    include: { parent: { select: { name: true, slug: true, isActive: true } } },
  });
  if (!category || !category.isActive) return null;
  const all = await getCategories();
  return {
    category,
    ids: descendantIds(all, category.id),
    children: all.filter((c) => c.parentId === category.id),
  };
}

// ---------------------------------------------------------------------------
// Product page
// ---------------------------------------------------------------------------

export async function getProductPage(slug: string, viewer: Viewer, options: { preview?: boolean } = {}) {
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          parent: { select: { name: true, slug: true } },
          sizeChart: true,
        },
      },
      sizeChart: true,
      media: { orderBy: { position: "asc" } },
      variants: {
        where: { isActive: true, archivedAt: null },
        orderBy: { position: "asc" },
      },
      attributeValues: {
        where: { attribute: { showOnProductPage: true } },
        include: { attribute: { select: { key: true, label: true, unit: true, position: true } } },
      },
      wholesalePrices: {
        where: { priceTierId: { in: viewerTierIds(viewer) } },
        orderBy: { minQuantity: "asc" },
        select: { priceTierId: true, minQuantity: true, unitPrice: true },
      },
    },
  });
  if (!product) return null;
  product.wholesalePrices = tierPricesFor(product.wholesalePrices, viewer);

  const now = new Date();
  const live =
    product.status === "ACTIVE" &&
    (product.publishAt == null || product.publishAt <= now) &&
    product.category.isActive;
  if (!live && !options.preview) return null;

  const reviews = await db.review.findMany({
    where: { productId: product.id, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      isVerifiedPurchase: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });

  // Group attribute values (a MULTI_SELECT has several rows) in admin order.
  const specs = new Map<string, { label: string; values: string[]; unit: string | null; position: number }>();
  for (const av of product.attributeValues) {
    const entry = specs.get(av.attribute.key) ?? {
      label: av.attribute.label,
      values: [],
      unit: av.attribute.unit,
      position: av.attribute.position,
    };
    entry.values.push(av.value);
    specs.set(av.attribute.key, entry);
  }

  return {
    product,
    live,
    specs: [...specs.entries()]
      .map(([key, s]) => ({ key, ...s }))
      .sort((a, b) => a.position - b.position),
    sizeChart: product.sizeChart ?? product.category.sizeChart,
    reviews,
  };
}

export type ProductPage = NonNullable<Awaited<ReturnType<typeof getProductPage>>>;
