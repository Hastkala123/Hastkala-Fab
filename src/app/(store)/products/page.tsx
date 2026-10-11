import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { canSeeWholesalePricing, getCurrentUser } from "@/lib/auth";
import { getFacets, queryProducts } from "@/lib/products";
import { productQuerySchema } from "@/lib/validators";
import FilterSidebar from "@/components/store/FilterSidebar";
import { EmptyState, Pagination, ProductGrid } from "@/components/store/ProductGrid";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 60) : null;

  return {
    title: q
      ? `Search results for "${q}"`
      : "All Sanganeri Print Products — Kurtis, Sarees, Suits & Bedsheets",
    description: q
      ? `Sanganeri hand block print products matching "${q}" at Hastkala Fab.`
      : "Browse the full Hastkala Fab collection of authentic Sanganeri hand block print kurtis, sarees, ladies suits, bedsheets, dupattas and cotton fabric.",
    alternates: { canonical: "/products" },
    // Filtered and paginated permutations are near-duplicates; indexing them
    // splits ranking signal across thousands of thin URLs.
    robots: Object.keys(params).length > 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;

  // Unparseable filters fall back to defaults rather than 500-ing the page.
  const parsed = productQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : productQuerySchema.parse({});

  const [user, { products, total, page, totalPages }, facets] = await Promise.all([
    getCurrentUser(),
    queryProducts(query),
    getFacets(),
  ]);

  const showWholesale = canSeeWholesalePricing(user) && user?.role === "WHOLESALE";

  const wishlistIds = user
    ? new Set(
        (
          await db.wishlistItem.findMany({
            where: { userId: user.id },
            select: { productId: true },
          })
        ).map((w) => w.productId),
      )
    : new Set<string>();

  function buildHref(nextPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string" && key !== "page") params.set(key, value);
    }
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  }

  return (
    <div className="hf-container py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-indigo-ink-950 sm:text-4xl">
          {query.q ? `Results for "${query.q}"` : "All products"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {total} {total === 1 ? "piece" : "pieces"}
          {query.q ? " matched your search" : " in the collection"}
          {showWholesale && " · showing your wholesale rates"}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-10">
        <Suspense fallback={<div className="hf-skeleton h-96 rounded-card" />}>
          <FilterSidebar facets={facets} />
        </Suspense>

        <div>
          {products.length === 0 ? (
            <EmptyState
              title="Nothing matched"
              message={
                query.q
                  ? `We could not find anything for "${query.q}". Try a different word, or browse the full collection.`
                  : "No products match these filters. Try widening your price range."
              }
              action={{ href: "/products", label: "Browse everything" }}
            />
          ) : (
            <>
              <ProductGrid
                products={products}
                showWholesale={showWholesale}
                wishlistIds={wishlistIds}
              />
              <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
