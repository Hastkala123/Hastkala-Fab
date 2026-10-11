import type { Metadata } from "next";
import { getCurrentUser, isApprovedWholesale } from "@/lib/auth";
import { listProducts } from "@/server/catalog/products";
import { pageHref, parseListingParams, type RawSearchParams } from "@/server/catalog/params";
import { viewerFor } from "@/server/catalog/viewer";
import { wishlistIdsFor } from "@/server/catalog/wishlist";
import ListingView from "@/components/store/ListingView";

type Props = { searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 60) : "";
  return {
    title: q ? `Search: ${q}` : "Shop all — Sanganeri Kurtis, Sarees, Suits & Bedsheets",
    description:
      "Browse every Hastkala Fab design: Sanganeri hand block print kurtis, salwar suits, sarees and Jaipuri cotton bedsheets.",
    alternates: { canonical: "/search" },
    // Search results are thin, ever-changing pages: keep them out of the index.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const raw = await searchParams;
  const query = parseListingParams(raw);
  const user = await getCurrentUser();
  const [listing, wishlistIds] = await Promise.all([listProducts(query, await viewerFor(user)), wishlistIdsFor(user)]);

  return (
    <ListingView
      crumbs={[
        { href: "/", label: "Home" },
        { href: "/search", label: query.q ? "Search" : "Shop all" },
      ]}
      title={query.q ? `Results for “${query.q}”` : "Shop all"}
      listing={listing}
      wishlistIds={wishlistIds}
      buildHref={(n) => pageHref("/search", raw, n)}
      showingWholesale={isApprovedWholesale(user)}
      emptyAction={{ href: "/search", label: "Clear search" }}
    />
  );
}
