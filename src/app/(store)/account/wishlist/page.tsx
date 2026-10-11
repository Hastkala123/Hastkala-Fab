import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { canSeeWholesalePricing, requireUser } from "@/lib/auth";
import { productCardSelect } from "@/lib/products";
import ProductCard from "@/components/store/ProductCard";

export const metadata: Metadata = {
  title: "My Wishlist",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const user = await requireUser();

  const items = await db.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { product: { select: productCardSelect } },
  });

  const showWholesale =
    canSeeWholesalePricing({ ...user }) && user.role === "WHOLESALE";

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950 sm:text-3xl">
        My wishlist
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {items.length === 0
          ? "Nothing saved yet."
          : `${items.length} saved ${items.length === 1 ? "piece" : "pieces"}`}
      </p>

      {items.length === 0 ? (
        <div className="hf-card mt-6 p-10 text-center">
          <p className="text-sm text-slate-500">
            Tap the heart on any product to save it here for later.
          </p>
          <Link href="/products" className="hf-btn hf-btn-primary mt-5">
            Browse the collection
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 lg:grid-cols-3">
          {items.map((item) => (
            <ProductCard
              key={item.id}
              product={item.product}
              showWholesale={showWholesale}
              wishlisted
            />
          ))}
        </div>
      )}
    </div>
  );
}
