"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { formatPrice } from "@/lib/money";
import { productPath } from "@/lib/routes";
import { useToast } from "@/components/ui/Toast";

type Design = {
  id: string;
  title: string;
  slug: string;
  categoryName: string;
  image: { url: string; alt: string } | null;
  minQuantity: number | null;
  prices: { minQuantity: number; unitPrice: number }[];
  variants: { id: string; sku: string; label: string; stock: number }[];
};

/** The trade price for this many pieces of a design (null below the minimum). */
function unitPriceFor(design: Design, pieces: number): number | null {
  if (design.minQuantity != null && pieces < design.minQuantity) return null;
  let best: { minQuantity: number; unitPrice: number } | null = null;
  for (const p of design.prices) if (pieces >= p.minQuantity && (!best || p.minQuantity > best.minQuantity)) best = p;
  return best?.unitPrice ?? null;
}

export default function QuickOrderGrid({ designs, plusGst }: { designs: Design[]; plusGst: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const categories = useMemo(() => [...new Set(designs.map((d) => d.categoryName))], [designs]);
  const qty = (variantId: string) => Math.max(0, Math.floor(Number(quantities[variantId] ?? 0)) || 0);

  const totals = useMemo(() => {
    let pieces = 0;
    let amount = 0;
    let belowMinimum = 0;
    for (const design of designs) {
      const designPieces = design.variants.reduce((sum, v) => sum + qty(v.id), 0);
      if (designPieces === 0) continue;
      pieces += designPieces;
      const unit = unitPriceFor(design, designPieces);
      if (unit == null) belowMinimum++;
      else amount += unit * designPieces;
    }
    return { pieces, amount, belowMinimum };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designs, quantities]);

  const needle = query.trim().toLowerCase();
  const visible = designs.filter(
    (d) =>
      (!category || d.categoryName === category) &&
      (!needle || d.title.toLowerCase().includes(needle) || d.variants.some((v) => v.sku.toLowerCase().includes(needle))),
  );

  async function addToBag() {
    const items = designs.flatMap((d) => d.variants.filter((v) => qty(v.id) > 0).map((v) => ({ variantId: v.id, quantity: qty(v.id) })));
    if (items.length === 0) {
      toast("Enter a quantity for at least one size.", "error");
      return;
    }
    setPending(true);
    setProblems({});
    const result = await apiRequest<{ lines: number }>("/api/wholesale/quick-order", { body: { items } });
    setPending(false);
    if (!result.ok) {
      setProblems(result.fields ?? {});
      toast(result.error, "error");
      return;
    }
    toast(`${result.data.lines} line${result.data.lines === 1 ? "" : "s"} added to your bag`, "success");
    router.push("/cart");
    router.refresh();
  }

  return (
    <div className="pb-28">
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search design or SKU"
          aria-label="Search designs"
          className="hf-input max-w-xs"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="hf-input max-w-xs">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="hf-card mt-6 p-8 text-center text-sm text-slate-500">No designs match.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {visible.map((design) => {
            const pieces = design.variants.reduce((sum, v) => sum + qty(v.id), 0);
            const unit = pieces > 0 ? unitPriceFor(design, pieces) : null;
            const short = design.minQuantity != null && pieces > 0 && pieces < design.minQuantity ? design.minQuantity - pieces : 0;
            return (
              <li key={design.id} className="hf-card p-4">
                <div className="flex gap-4">
                  <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded bg-cotton-100 sm:w-20">
                    {design.image && <Image src={design.image.url} alt={design.image.alt} fill sizes="80px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={productPath(design.slug)} className="font-semibold text-indigo-ink-900 hover:underline">
                          {design.title}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {design.categoryName}
                          {design.minQuantity ? ` · min. ${design.minQuantity} pcs (sizes combined)` : ""}
                        </p>
                      </div>
                      <p className="text-right text-xs text-slate-600">
                        {design.prices.map((p) => `${p.minQuantity}+ @ ${formatPrice(p.unitPrice)}`).join(" · ")}
                        {plusGst ? " + GST" : ""}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2.5">
                      {design.variants.map((variant) => {
                        const problem = problems[variant.id];
                        const soldOut = variant.stock <= 0;
                        return (
                          <label key={variant.id} className="w-24">
                            <span className="block truncate text-xs font-medium text-slate-700" title={variant.label}>
                              {variant.label}
                            </span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={variant.stock}
                              disabled={soldOut}
                              value={quantities[variant.id] ?? ""}
                              onChange={(e) => setQuantities((q) => ({ ...q, [variant.id]: e.target.value }))}
                              placeholder="0"
                              aria-invalid={Boolean(problem) || qty(variant.id) > variant.stock}
                              className={`hf-input mt-0.5 py-1.5 text-sm ${problem || qty(variant.id) > variant.stock ? "border-madder-500" : ""}`}
                            />
                            <span className={`block text-[11px] ${problem || qty(variant.id) > variant.stock ? "text-madder-600" : "text-slate-400"}`}>
                              {problem ?? (soldOut ? "Sold out" : `${variant.stock} in stock`)}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {pieces > 0 && (
                      <p className="mt-2 text-sm">
                        {short > 0 ? (
                          <span className="font-medium text-madder-700">Add {short} more piece{short === 1 ? "" : "s"} to reach the minimum</span>
                        ) : unit != null ? (
                          <>
                            <span className="text-slate-600">
                              {pieces} pcs × {formatPrice(unit)} ={" "}
                            </span>
                            <span className="font-bold text-indigo-ink-950">{formatPrice(unit * pieces)}</span>
                            {plusGst && <span className="text-slate-500"> + GST</span>}
                          </>
                        ) : null}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cotton-300 bg-white/95 backdrop-blur">
        <div className="hf-container flex flex-wrap items-center justify-between gap-3 py-3">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">{totals.pieces}</span> pcs ·{" "}
            <span className="font-bold text-indigo-ink-950">{formatPrice(totals.amount)}</span>
            {plusGst ? " + GST" : ""}
            {totals.belowMinimum > 0 && (
              <span className="ml-2 text-madder-700">
                · {totals.belowMinimum} design{totals.belowMinimum === 1 ? "" : "s"} below minimum
              </span>
            )}
          </p>
          <button type="button" onClick={addToBag} disabled={pending || totals.pieces === 0} className="hf-btn hf-btn-accent px-6">
            {pending ? "Adding…" : "Add to bag"}
          </button>
        </div>
      </div>
    </div>
  );
}
