import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUserPage } from "@/server/auth/page-guard";
import { cardsByIds } from "@/server/catalog/products";
import { viewerFor } from "@/server/catalog/viewer";
import ProductCard from "@/components/store/ProductCard";

export const metadata: Metadata = {
  title: "My Wishlist",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const user = await requireUserPage();
  const saved = await db.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { productId: true },
  });
  // Products that were archived since are left out.
  const products = await cardsByIds(
    saved.map((s) => s.productId),
    await viewerFor(user),
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950 sm:text-3xl">My wishlist</h1>
      <p className="mt-1 text-sm text-slate-600">
        {products.length === 0
          ? "Nothing saved yet."
          : `${products.length} saved ${products.length === 1 ? "piece" : "pieces"}`}
      </p>

      {products.length === 0 ? (
        <div className="hf-card mt-6 p-10 text-center">
          <p className="text-sm text-slate-500">Tap the heart on any product to save it here for later.</p>
          <Link href="/search" className="hf-btn hf-btn-primary mt-5">
            Browse the collection
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} wishlisted />
          ))}
        </div>
      )}
    </div>
  );
}
