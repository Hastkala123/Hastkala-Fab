import Link from "next/link";
import ProductCard, { type ProductCardData } from "./ProductCard";
import { pageRange } from "@/lib/utils";

export function ProductGrid({
  products,
  showWholesale,
  wishlistIds,
}: {
  products: ProductCardData[];
  showWholesale: boolean;
  wishlistIds: Set<string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          showWholesale={showWholesale}
          priority={index < 4}
          wishlisted={wishlistIds.has(product.id)}
        />
      ))}
    </div>
  );
}

/**
 * Pagination rendered as real anchors rather than buttons, so each page is
 * crawlable and shareable — important for a catalogue that depends on organic
 * search traffic.
 */
export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link
          href={buildHref(page - 1)}
          rel="prev"
          className="hf-btn hf-btn-outline px-3 py-2 text-sm"
        >
          ← Prev
        </Link>
      ) : (
        <span className="hf-btn px-3 py-2 text-sm text-slate-400">← Prev</span>
      )}

      {pageRange(page, totalPages).map((entry, index) =>
        entry === "…" ? (
          <span key={`gap-${index}`} className="px-2 text-sm text-slate-400">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={buildHref(entry)}
            aria-current={entry === page ? "page" : undefined}
            className={
              entry === page
                ? "hf-btn hf-btn-primary min-w-9 px-3 py-2 text-sm"
                : "hf-btn hf-btn-outline min-w-9 px-3 py-2 text-sm"
            }
          >
            {entry}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link
          href={buildHref(page + 1)}
          rel="next"
          className="hf-btn hf-btn-outline px-3 py-2 text-sm"
        >
          Next →
        </Link>
      ) : (
        <span className="hf-btn px-3 py-2 text-sm text-slate-400">Next →</span>
      )}
    </nav>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="hf-card flex flex-col items-center px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="grid h-14 w-14 place-items-center rounded-full bg-cotton-200 text-2xl text-indigo-ink-500"
      >
        ✦
      </span>
      <h2 className="mt-4 font-display text-xl font-bold text-indigo-ink-950">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-600">{message}</p>
      {action && (
        <Link href={action.href} className="hf-btn hf-btn-primary mt-6">
          {action.label}
        </Link>
      )}
    </div>
  );
}
