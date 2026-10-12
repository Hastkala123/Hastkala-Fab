import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { categoryPath, productPath } from "@/lib/routes";
import { getCategories, liveProductWhere } from "@/server/catalog/products";
import { pagePath } from "@/server/content/pages";
import { wholesaleCategories } from "@/server/wholesale/catalogue";

export const dynamic = "force-dynamic";

/**
 * Every public page worth finding in search: categories, live products,
 * wholesale pages and published content pages. Account, cart and admin
 * pages are left out (and blocked in robots.txt).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const url = (path: string) => `${base}${path}`;

  const [categories, products, pages, wholesale, faqUpdated] = await Promise.all([
    getCategories(),
    db.product.findMany({
      where: liveProductWhere(),
      orderBy: { updatedAt: "desc" },
      take: 45_000,
      select: { slug: true, updatedAt: true },
    }),
    db.page.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    wholesaleCategories(),
    db.faq.aggregate({ where: { isActive: true }, _max: { updatedAt: true } }),
  ]);
  const slugById = new Map(categories.map((c) => [c.id, c.slug]));

  return [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    ...categories.map((c) => ({
      url: url(categoryPath(c.slug, c.parentId ? slugById.get(c.parentId) : null)),
      changeFrequency: "daily" as const,
      priority: c.parentId ? 0.7 : 0.9,
    })),
    ...products.map((p) => ({ url: url(productPath(p.slug)), lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    { url: url("/wholesale"), changeFrequency: "weekly", priority: 0.8 },
    ...wholesale.map((c) => ({ url: url(`/wholesale/${c.slug}`), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...pages.map((p) => ({ url: url(pagePath(p.slug)), lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.4 })),
    { url: url("/faq"), lastModified: faqUpdated._max.updatedAt ?? undefined, changeFrequency: "monthly", priority: 0.5 },
    ...(pages.some((p) => p.slug === "contact") ? [] : [{ url: url("/contact"), changeFrequency: "yearly" as const, priority: 0.4 }]),
    { url: url("/track"), changeFrequency: "yearly", priority: 0.3 },
  ];
}
