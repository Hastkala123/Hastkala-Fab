import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { PAGE_SIZE } from "./utils";
import type { ProductQuery } from "./validators";

export const productCardSelect = {
  id: true,
  title: true,
  slug: true,
  priceRetail: true,
  priceWholesale: true,
  mrp: true,
  stock: true,
  isNew: true,
  fabric: true,
  ratingAvg: true,
  ratingCount: true,
  images: {
    orderBy: { position: "asc" },
    take: 2,
    select: { url: true, alt: true },
  },
} satisfies Prisma.ProductSelect;

const SORT_ORDER: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  "price-asc": { priceRetail: "asc" },
  "price-desc": { priceRetail: "desc" },
  popular: { soldCount: "desc" },
  rating: { ratingAvg: "desc" },
};

/**
 * Shared catalogue query used by /products and /category/[slug].
 *
 * Every filter comes from a Zod-parsed query object, and all matching is done
 * through Prisma's query builder — no string concatenation ever reaches SQL.
 */
export async function queryProducts(
  params: ProductQuery & { categoryIds?: string[] },
) {
  const where: Prisma.ProductWhereInput = { isActive: true };

  if (params.categoryIds?.length) {
    where.categoryId = { in: params.categoryIds };
  }

  if (params.q) {
    // SQLite's LIKE is case-insensitive for ASCII by default, which is what we
    // want here; Prisma's `mode: "insensitive"` is a PostgreSQL-only option.
    where.OR = [
      { title: { contains: params.q } },
      { description: { contains: params.q } },
      { keywords: { contains: params.q } },
      { fabric: { contains: params.q } },
      { sku: { contains: params.q } },
    ];
  }

  if (params.fabric) where.fabric = { contains: params.fabric };
  if (params.occasion) where.occasion = { contains: params.occasion };

  if (params.minPrice != null || params.maxPrice != null) {
    where.priceRetail = {};
    if (params.minPrice != null) where.priceRetail.gte = params.minPrice * 100;
    if (params.maxPrice != null) where.priceRetail.lte = params.maxPrice * 100;
  }

  const page = Math.max(1, params.page);

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: SORT_ORDER[params.sort] ?? SORT_ORDER.newest,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: productCardSelect,
    }),
    db.product.count({ where }),
  ]);

  return {
    products,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Distinct facet values, used to populate the filter sidebar. */
export async function getFacets(categoryIds?: string[]) {
  const where: Prisma.ProductWhereInput = { isActive: true };
  if (categoryIds?.length) where.categoryId = { in: categoryIds };

  const [fabrics, occasions, priceRange] = await Promise.all([
    db.product.findMany({
      where: { ...where, fabric: { not: null } },
      distinct: ["fabric"],
      select: { fabric: true },
      take: 30,
    }),
    db.product.findMany({
      where: { ...where, occasion: { not: null } },
      distinct: ["occasion"],
      select: { occasion: true },
      take: 30,
    }),
    db.product.aggregate({
      where,
      _min: { priceRetail: true },
      _max: { priceRetail: true },
    }),
  ]);

  return {
    fabrics: fabrics.map((f) => f.fabric).filter((f): f is string => Boolean(f)),
    // "Daily Wear, Office" is stored as one string; split it into real facets.
    occasions: [
      ...new Set(
        occasions
          .flatMap((o) => (o.occasion ?? "").split(",").map((s) => s.trim()))
          .filter(Boolean),
      ),
    ],
    minPrice: Math.floor((priceRange._min.priceRetail ?? 0) / 100),
    maxPrice: Math.ceil((priceRange._max.priceRetail ?? 0) / 100),
  };
}

/** A category plus all of its children, for "show everything under Kurtis". */
export async function getCategoryWithDescendants(slug: string) {
  const category = await db.category.findUnique({
    where: { slug },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        select: { id: true, name: true, slug: true },
      },
      parent: { select: { name: true, slug: true } },
    },
  });

  if (!category || !category.isActive) return null;

  return {
    category,
    ids: [category.id, ...category.children.map((c) => c.id)],
  };
}
