import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/money";
import { productPath } from "@/lib/routes";
import type { WholesaleDesign } from "@/server/wholesale/catalogue";

/**
 * A design on the wholesale pages. Approved buyers see their trade price;
 * everyone else sees the minimum quantity and how to get prices.
 */
export default function DesignCard({
  design,
  showTradePrice,
  plusGst,
}: {
  design: WholesaleDesign;
  showTradePrice: boolean;
  plusGst: boolean;
}) {
  const lowest = design.prices[0] ?? null;
  const sizes = [...new Set(design.variants.map((v) => v.label))];
  return (
    <Link href={productPath(design.slug)} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-card bg-cotton-100">
        {design.image ? (
          <Image
            src={design.image.url}
            alt={design.image.alt}
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full bg-cotton-200" />
        )}
      </div>
      <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">{design.categoryName}</p>
      <p className="hf-clamp-2 mt-0.5 font-medium text-indigo-ink-900 group-hover:underline">{design.title}</p>
      {showTradePrice && lowest ? (
        <p className="mt-1 text-sm">
          <span className="font-bold text-indigo-ink-950">{formatPrice(lowest.unitPrice)}</span>
          <span className="text-slate-500">
            {plusGst ? " + GST" : ""} / pc from {lowest.minQuantity} pcs
          </span>
        </p>
      ) : (
        <p className="mt-1 text-sm text-slate-600">
          {design.minQuantity ? `Min. ${design.minQuantity} pcs · ` : ""}Trade price after approval
        </p>
      )}
      {sizes.length > 1 && <p className="mt-0.5 text-xs text-slate-500">{sizes.slice(0, 6).join(" · ")}{sizes.length > 6 ? " …" : ""}</p>}
    </Link>
  );
}
