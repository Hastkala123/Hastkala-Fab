import Image from "next/image";
import Link from "next/link";
import { discountPercent, formatPrice } from "@/lib/money";
import { productPath } from "@/lib/routes";
import type { ProductCardData } from "@/server/catalog/products";
import WishlistButton from "./WishlistButton";

export type { ProductCardData };

export default function ProductCard({
  product,
  priority = false,
  wishlisted = false,
}: {
  product: ProductCardData;
  priority?: boolean;
  wishlisted?: boolean;
}) {
  const price = product.price;
  const off = discountPercent(product.mrp, price);
  const image = product.image;
  const secondary = product.hoverImage;
  const outOfStock = !product.inStock;
  const href = productPath(product.slug);

  return (
    <article className="group relative">
      <div className="relative overflow-hidden rounded-card bg-cotton-100 ring-1 ring-cotton-300">
        <Link href={href} className="block" tabIndex={-1} aria-hidden="true">
          <div className="relative aspect-[3/4] w-full">
            {image ? (
              <>
                <Image
                  src={image.url}
                  alt={image.alt || product.title}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  priority={priority}
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Second image cross-fades on hover — a cheap, high-impact
                    merchandising win on ethnic wear where drape matters. */}
                {secondary && (
                  <Image
                    src={secondary.url}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  />
                )}
              </>
            ) : (
              <div className="grid h-full w-full place-items-center bg-cotton-200 text-cotton-500">
                <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </div>
            )}
          </div>
        </Link>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <div className="flex flex-col gap-1.5">
            {off > 0 && (
              <span className="pointer-events-auto rounded-md bg-madder-600 px-2 py-1 text-[11px] font-bold text-white shadow-sm">
                {off}% OFF
              </span>
            )}
            {product.isNew && off === 0 && (
              <span className="pointer-events-auto rounded-md bg-indigo-ink-800 px-2 py-1 text-[11px] font-bold text-white shadow-sm">
                NEW
              </span>
            )}
          </div>
          <div className="pointer-events-auto">
            <WishlistButton productId={product.id} initial={wishlisted} />
          </div>
        </div>

        {outOfStock && (
          <div className="absolute inset-0 grid place-items-center bg-cotton-50/75 backdrop-blur-[1px]">
            <span className="rounded-md bg-indigo-ink-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
              Sold out
            </span>
          </div>
        )}
      </div>

      <div className="pt-3">
        <h3 className="hf-clamp-2 text-sm font-semibold leading-snug text-indigo-ink-900">
          {/* Stretched link: the whole card is clickable, but only one
              focusable element exists for keyboard and screen-reader users. */}
          <Link href={href} className="after:absolute after:inset-0">
            {product.title}
          </Link>
        </h3>

        <p className="mt-0.5 text-xs text-slate-500">{product.categoryName}</p>

        {product.rating && (
          <div className="mt-1.5 flex items-center gap-1">
            <span className="flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
              {product.rating.average.toFixed(1)}
              <span aria-hidden="true">★</span>
              <span className="sr-only">out of 5</span>
            </span>
            <span className="text-[11px] text-slate-400">({product.rating.count})</span>
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-base font-bold text-indigo-ink-950">
            {formatPrice(price)}
          </span>
          {product.mrp > price && (
            <span className="text-sm text-slate-400 line-through">
              {formatPrice(product.mrp)}
            </span>
          )}
        </div>

        {product.wholesale && (
          <p className="mt-1 text-xs font-semibold text-madder-600">
            Wholesale {formatPrice(product.wholesale.unitPrice)}
            {product.wholesale.plusGst ? " + GST" : ""} · {product.wholesale.minQuantity}+ pcs
          </p>
        )}
      </div>
    </article>
  );
}
