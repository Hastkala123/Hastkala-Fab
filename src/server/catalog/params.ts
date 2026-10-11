import "server-only";

import { listingQuerySchema } from "@/lib/validators";
import type { ListingQuery } from "./products";

export type RawSearchParams = Record<string, string | string[] | undefined>;

const ATTRIBUTE_PARAM = /^f_([a-z0-9_]{1,40})$/;

/**
 * Turns ?sort=…&size=M,L&f_fabric=Cotton into a listing query. Anything
 * malformed falls back to a default instead of erroring the page.
 */
export function parseListingParams(raw: RawSearchParams): Omit<ListingQuery, "categoryIds" | "collectionId"> {
  const base = listingQuerySchema.parse(raw);
  const attrs: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    const match = ATTRIBUTE_PARAM.exec(key);
    if (!match || value == null) continue;
    const values = (Array.isArray(value) ? value : value.split(","))
      .map((v) => v.trim())
      .filter((v) => v.length > 0 && v.length <= 80)
      .slice(0, 20);
    if (values.length) attrs[match[1]!] = values;
    if (Object.keys(attrs).length >= 10) break;
  }
  return {
    q: base.q || undefined,
    minPrice: base.min != null ? base.min * 100 : undefined,
    maxPrice: base.max != null ? base.max * 100 : undefined,
    sizes: base.size,
    colors: base.color,
    inStock: base.stock === "1",
    attrs,
    sort: base.sort,
    page: base.page,
  };
}

/** Same filters, another page number — for pagination links. */
export function pageHref(pathname: string, raw: RawSearchParams, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (key === "page" || value == null) continue;
    params.set(key, Array.isArray(value) ? value.join(",") : value);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Filtered or paginated variants are near-duplicates and shouldn't be indexed. */
export function hasFilters(raw: RawSearchParams): boolean {
  return Object.keys(raw).length > 0;
}
