import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getCurrentUser, isApprovedWholesale } from "@/lib/auth";
import { categoryPath, isReservedSlug } from "@/lib/routes";
import { getCategoryPage, listProducts } from "@/server/catalog/products";
import { hasFilters, pageHref, parseListingParams, type RawSearchParams } from "@/server/catalog/params";
import { viewerFor } from "@/server/catalog/viewer";
import { wishlistIdsFor } from "@/server/catalog/wishlist";
import ListingView from "@/components/store/ListingView";

/**
 * Category pages: /kurtis and /kurtis/cotton-kurtis. Name, intro, SEO text,
 * order and sub-categories all come from Admin → Categories.
 */

async function load(slug: string, parentSlug: string | null) {
  if (isReservedSlug(slug)) return null;
  const page = await getCategoryPage(slug);
  if (!page) return null;
  const actualParent = page.category.parent?.isActive ? page.category.parent.slug : null;
  return { ...page, actualParent, canonical: categoryPath(slug, actualParent), requested: categoryPath(slug, parentSlug) };
}

export async function categoryMetadata(slug: string, parentSlug: string | null, raw: RawSearchParams): Promise<Metadata> {
  const page = await load(slug, parentSlug);
  if (!page) return { title: "Page not found", robots: { index: false, follow: false } };
  const { category } = page;
  const title = category.metaTitle ?? `${category.name} — Sanganeri Hand Block Print`;
  const description =
    category.metaDescription ??
    category.description?.slice(0, 160) ??
    `Shop Sanganeri hand block print ${category.name.toLowerCase()} from Jaipur at Hastkala Fab. Retail and wholesale.`;
  return {
    title,
    description,
    alternates: { canonical: page.canonical },
    openGraph: { title, description, url: page.canonical, images: category.bannerImageUrl ?? category.imageUrl ?? undefined },
    robots: hasFilters(raw) ? { index: false, follow: true } : undefined,
  };
}

export async function CategoryListing({
  slug,
  parentSlug,
  raw,
}: {
  slug: string;
  parentSlug: string | null;
  raw: RawSearchParams;
}) {
  const page = await load(slug, parentSlug);
  if (!page) notFound();
  // /cotton-kurtis or /sarees/cotton-kurtis → the one true address.
  if (page.requested !== page.canonical) {
    const query = new URLSearchParams(
      Object.entries(raw).flatMap(([k, v]) => (v == null ? [] : [[k, Array.isArray(v) ? v.join(",") : v]])),
    ).toString();
    permanentRedirect(query ? `${page.canonical}?${query}` : page.canonical);
  }

  const user = await getCurrentUser();
  const viewer = await viewerFor(user);
  const [listing, wishlistIds] = await Promise.all([
    listProducts({ ...parseListingParams(raw), categoryIds: page.ids }, viewer),
    wishlistIdsFor(user),
  ]);
  const { category } = page;

  return (
    <ListingView
      crumbs={[
        { href: "/", label: "Home" },
        ...(page.actualParent && category.parent
          ? [{ href: categoryPath(category.parent.slug), label: category.parent.name }]
          : []),
        { href: page.canonical, label: category.name },
      ]}
      title={category.name}
      intro={category.description}
      bottomContent={category.bottomContent}
      listing={listing}
      wishlistIds={wishlistIds}
      buildHref={(n) => pageHref(page.canonical, raw, n)}
      chips={page.children.map((child) => ({ href: categoryPath(child.slug, category.slug), label: child.name }))}
      showingWholesale={isApprovedWholesale(user)}
    />
  );
}
