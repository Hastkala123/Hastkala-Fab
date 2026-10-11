import Link from "next/link";
import { Suspense } from "react";
import type { Listing } from "@/server/catalog/products";
import FilterSidebar from "./FilterSidebar";
import Breadcrumbs, { type Crumb } from "./Breadcrumbs";
import { EmptyState, Pagination, ProductGrid } from "./ProductGrid";

/** Category, sub-category, collection and search pages all render through this. */
export default function ListingView({
  crumbs,
  title,
  intro,
  bottomContent,
  listing,
  wishlistIds,
  buildHref,
  chips,
  showingWholesale,
  emptyAction = { href: "/search", label: "Browse everything" },
}: {
  crumbs: Crumb[];
  title: string;
  intro?: string | null;
  bottomContent?: string | null;
  listing: Listing;
  wishlistIds: Set<string>;
  buildHref: (page: number) => string;
  chips?: { href: string; label: string }[];
  showingWholesale?: boolean;
  emptyAction?: { href: string; label: string };
}) {
  return (
    <div className="hf-container py-8 sm:py-12">
      <Breadcrumbs items={crumbs} />

      <header className="mt-6 mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-indigo-ink-950 sm:text-4xl">{title}</h1>
        {intro && <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">{intro}</p>}
        <p className="mt-3 text-sm text-slate-500">
          {listing.total} {listing.total === 1 ? "design" : "designs"}
          {showingWholesale && " · showing your wholesale prices"}
        </p>

        {chips && chips.length > 0 && (
          <nav aria-label="Sub-categories" className="mt-5 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Link
                key={chip.href}
                href={chip.href}
                className="rounded-full border border-cotton-300 bg-white px-3.5 py-1.5 text-sm font-medium text-indigo-ink-800 transition hover:border-indigo-ink-500 hover:bg-indigo-ink-50"
              >
                {chip.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-10">
        <Suspense fallback={<div className="hf-skeleton h-96 rounded-card" />}>
          <FilterSidebar facets={listing.facets} />
        </Suspense>

        <div>
          {listing.products.length === 0 ? (
            <EmptyState
              title="Nothing matches yet"
              message="Try removing a filter or two, or browse everything we have."
              action={emptyAction}
            />
          ) : (
            <>
              <ProductGrid products={listing.products} wishlistIds={wishlistIds} />
              <Pagination page={listing.page} totalPages={listing.totalPages} buildHref={buildHref} />
            </>
          )}
        </div>
      </div>

      {bottomContent && listing.page === 1 && (
        <section className="prose prose-sm mt-16 max-w-3xl whitespace-pre-line text-slate-600">{bottomContent}</section>
      )}
    </div>
  );
}
