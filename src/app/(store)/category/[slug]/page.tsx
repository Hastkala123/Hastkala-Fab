import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { canSeeWholesalePricing, getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getCategoryWithDescendants, getFacets, queryProducts } from "@/lib/products";
import { productQuerySchema } from "@/lib/validators";
import FilterSidebar from "@/components/store/FilterSidebar";
import { EmptyState, Pagination, ProductGrid } from "@/components/store/ProductGrid";
import Breadcrumbs from "@/components/store/Breadcrumbs";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await db.category.findUnique({
    where: { slug },
    select: {
      name: true,
      description: true,
      metaTitle: true,
      metaDescription: true,
      isActive: true,
    },
  });

  if (!category || !category.isActive) {
    return { title: "Category not found", robots: { index: false, follow: false } };
  }

  return {
    title: category.metaTitle ?? `${category.name} — Sanganeri Hand Block Print`,
    description:
      category.metaDescription ??
      category.description ??
      `Shop authentic Sanganeri hand block print ${category.name.toLowerCase()} at Hastkala Fab.`,
    alternates: { canonical: `/category/${slug}` },
    openGraph: {
      title: category.metaTitle ?? category.name,
      description: category.metaDescription ?? category.description ?? undefined,
      url: `${env.NEXT_PUBLIC_SITE_URL}/category/${slug}`,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const raw = await searchParams;

  const result = await getCategoryWithDescendants(slug);
  if (!result) notFound();

  const { category, ids } = result;

  const parsed = productQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : productQuerySchema.parse({});

  const [user, listing, facets] = await Promise.all([
    getCurrentUser(),
    queryProducts({ ...query, categoryIds: ids }),
    getFacets(ids),
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
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string" && key !== "page") search.set(key, value);
    }
    if (nextPage > 1) search.set("page", String(nextPage));
    const qs = search.toString();
    return qs ? `/category/${slug}?${qs}` : `/category/${slug}`;
  }

  const crumbs = [
    { href: "/", label: "Home" },
    ...(category.parent
      ? [{ href: `/category/${category.parent.slug}`, label: category.parent.name }]
      : []),
    { href: `/category/${slug}`, label: category.name },
  ];

  return (
    <div className="hf-container py-8 sm:py-12">
      <Breadcrumbs items={crumbs} />

      <header className="mt-6 mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-indigo-ink-950 sm:text-4xl">
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
            {category.description}
          </p>
        )}
        <p className="mt-3 text-sm text-slate-500">
          {listing.total} {listing.total === 1 ? "piece" : "pieces"}
          {showWholesale && " · showing your wholesale rates"}
        </p>

        {category.children.length > 0 && (
          <nav aria-label="Sub-categories" className="mt-5 flex flex-wrap gap-2">
            {category.children.map((child) => (
              <Link
                key={child.id}
                href={`/category/${child.slug}`}
                className="rounded-full border border-cotton-300 bg-white px-3.5 py-1.5 text-sm font-medium text-indigo-ink-800 transition hover:border-indigo-ink-500 hover:bg-indigo-ink-50"
              >
                {child.name}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-10">
        <Suspense fallback={<div className="hf-skeleton h-96 rounded-card" />}>
          <FilterSidebar facets={facets} />
        </Suspense>

        <div>
          {listing.products.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              message={`We have no ${category.name.toLowerCase()} matching these filters right now. Try clearing the filters or browse the full collection.`}
              action={{ href: "/products", label: "Browse everything" }}
            />
          ) : (
            <>
              <ProductGrid
                products={listing.products}
                showWholesale={showWholesale}
                wishlistIds={wishlistIds}
              />
              <Pagination
                page={listing.page}
                totalPages={listing.totalPages}
                buildHref={buildHref}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
