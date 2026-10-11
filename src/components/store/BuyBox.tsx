"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { discountPercent, formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import WishlistButton from "./WishlistButton";

export type BuyBoxVariant = {
  id: string;
  size: string | null;
  colorName: string | null;
  colorHex: string | null;
  /** Name for variants that aren't a size or colour ("Double bed", "Pack of 3"). */
  optionLabel: string | null;
  price: number;
  mrp: number;
  stock: number;
};

export type BuyBoxWholesale = {
  tiers: { minQuantity: number; unitPrice: number }[];
  plusGst: boolean;
};

const unique = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))];

export default function BuyBox({
  productId,
  productTitle,
  variants,
  wholesale,
  maxPerLine,
  wishlisted,
}: {
  productId: string;
  productTitle: string;
  variants: BuyBoxVariant[];
  wholesale: BuyBoxWholesale | null;
  maxPerLine: number;
  wishlisted: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const sizes = useMemo(() => unique(variants.map((v) => v.size)), [variants]);
  const colors = useMemo(() => unique(variants.map((v) => v.colorName)), [variants]);
  const optionMode = sizes.length === 0 && colors.length === 0 && variants.length > 1;

  const inStock = variants.filter((v) => v.stock > 0);
  const only = inStock.length === 1 ? inStock[0]! : variants.length === 1 ? variants[0]! : null;

  // Preselect whatever is unambiguous: one in-stock variant, or a single colour.
  const [size, setSize] = useState<string | null>(only?.size ?? null);
  const [color, setColor] = useState<string | null>(only?.colorName ?? (colors.length === 1 ? colors[0]! : null));
  const [optionId, setOptionId] = useState<string | null>(only?.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);

  const selected = optionMode
    ? (variants.find((v) => v.id === optionId) ?? null)
    : variants.length === 1
      ? variants[0]!
      : (variants.find(
          (v) => (sizes.length === 0 || v.size === size) && (colors.length === 0 || v.colorName === color),
        ) ?? null);

  const cheapest = variants.reduce((low, v) => (v.price < low.price ? v : low), variants[0]!);
  const shown = selected ?? cheapest;
  const off = discountPercent(shown.mrp, shown.price);
  const stock = selected?.stock ?? 0;
  const maxQty = Math.max(1, Math.min(stock, maxPerLine));
  const needsSize = sizes.length > 0 && !size;
  const needsColor = colors.length > 0 && !color;
  const needsOption = optionMode && !optionId;
  const soldOut = inStock.length === 0 || (selected != null && selected.stock <= 0);

  const stockFor = (match: (v: BuyBoxVariant) => boolean) =>
    variants.filter(match).reduce((sum, v) => sum + v.stock, 0);

  async function addToCart(thenGoToCart: boolean) {
    if (pending) return;
    if (needsColor || needsSize || needsOption || !selected) {
      toast(needsColor ? "Please choose a colour." : needsSize ? "Please choose a size." : "Please choose an option.", "error");
      return;
    }
    setPending(true);
    const result = await apiRequest<{ itemCount: number }>("/api/cart", {
      body: { variantId: selected.id, quantity },
    });
    setPending(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`${productTitle} added to your bag`, "success");
    router.refresh();
    if (thenGoToCart) router.push("/cart");
  }

  const choose = (next: () => void) => {
    next();
    setQuantity(1);
  };

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-display text-3xl font-bold text-indigo-ink-950">
          {!selected && variants.some((v) => v.price !== cheapest.price) ? "From " : ""}
          {formatPrice(shown.price)}
        </span>
        {shown.mrp > shown.price && (
          <>
            <span className="text-lg text-slate-400 line-through">{formatPrice(shown.mrp)}</span>
            <span className="rounded-md bg-madder-600 px-2 py-1 text-xs font-bold text-white">{off}% OFF</span>
          </>
        )}
      </div>
      {/* Legal Metrology rules: MRP must be declared inclusive of all taxes. */}
      <p className="mt-1 text-xs text-slate-500">MRP inclusive of all taxes</p>

      {wholesale && wholesale.tiers.length > 0 && (
        <div className="mt-4 rounded-lg border border-madder-200 bg-madder-50 px-3.5 py-3">
          <p className="text-sm font-semibold text-madder-800">Your wholesale prices</p>
          <ul className="mt-1.5 space-y-0.5 text-sm text-madder-900">
            {wholesale.tiers.map((tier) => (
              <li key={tier.minQuantity}>
                {tier.minQuantity}+ pieces: <strong>{formatPrice(tier.unitPrice)}</strong>
                {wholesale.plusGst ? " + GST" : ""} each
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-madder-700">Mix sizes and colours of this design to reach the quantity.</p>
        </div>
      )}

      {colors.length > 0 && (
        <fieldset className="mt-6">
          <legend className="hf-label">
            Colour{color ? `: ${color}` : ""}{" "}
            {needsColor && <span className="font-normal text-madder-600">— choose one</span>}
          </legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {colors.map((c) => {
              const hex = variants.find((v) => v.colorName === c)?.colorHex;
              const available = stockFor((v) => v.colorName === c) > 0;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => choose(() => setColor(c))}
                  aria-pressed={color === c}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition",
                    color === c ? "border-indigo-ink-800 bg-indigo-ink-50" : "border-cotton-300 hover:border-indigo-ink-500",
                    !available && "text-cotton-500 line-through",
                  )}
                >
                  {hex && (
                    <span aria-hidden="true" className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ backgroundColor: hex }} />
                  )}
                  {c}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {sizes.length > 0 && (
        <fieldset className="mt-5">
          <legend className="hf-label">
            Size {needsSize && <span className="font-normal text-madder-600">— choose one</span>}
          </legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {sizes.map((s) => {
              const available =
                stockFor((v) => v.size === s && (colors.length === 0 || !color || v.colorName === color)) > 0;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!available}
                  onClick={() => choose(() => setSize(s))}
                  aria-pressed={size === s}
                  className={cn(
                    "min-w-12 rounded-lg border-2 px-3.5 py-2 text-sm font-semibold transition",
                    !available && "cursor-not-allowed border-cotton-200 text-cotton-400 line-through",
                    available && size === s
                      ? "border-indigo-ink-800 bg-indigo-ink-800 text-white"
                      : available && "border-cotton-300 text-indigo-ink-800 hover:border-indigo-ink-500",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {optionMode && (
        <fieldset className="mt-5">
          <legend className="hf-label">
            Option {needsOption && <span className="font-normal text-madder-600">— choose one</span>}
          </legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={v.stock <= 0}
                onClick={() => choose(() => setOptionId(v.id))}
                aria-pressed={optionId === v.id}
                className={cn(
                  "rounded-lg border-2 px-3.5 py-2 text-sm font-semibold transition",
                  v.stock <= 0 && "cursor-not-allowed border-cotton-200 text-cotton-400 line-through",
                  v.stock > 0 && optionId === v.id
                    ? "border-indigo-ink-800 bg-indigo-ink-800 text-white"
                    : v.stock > 0 && "border-cotton-300 text-indigo-ink-800 hover:border-indigo-ink-500",
                )}
              >
                {v.optionLabel ?? formatPrice(v.price)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {selected && selected.stock > 0 && selected.stock <= 5 && (
        <p className="mt-4 text-sm font-semibold text-madder-600">Only {selected.stock} left</p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-cotton-400">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1 || soldOut}
            className="px-3.5 py-2.5 text-lg leading-none text-indigo-ink-800 transition hover:bg-cotton-100 disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <label htmlFor="qty" className="sr-only">
            Quantity
          </label>
          <input
            id="qty"
            type="number"
            inputMode="numeric"
            value={quantity}
            min={1}
            max={maxQty}
            onChange={(e) => {
              const next = Math.floor(Number(e.target.value));
              if (Number.isFinite(next)) setQuantity(Math.max(1, Math.min(maxQty, next)));
            }}
            className="w-16 border-x border-cotton-300 py-2.5 text-center text-sm font-semibold text-indigo-ink-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
            disabled={quantity >= maxQty || soldOut || !selected}
            className="px-3.5 py-2.5 text-lg leading-none text-indigo-ink-800 transition hover:bg-cotton-100 disabled:opacity-40"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <p className="text-sm text-slate-500">
          {soldOut ? (
            <span className="font-semibold text-madder-600">Sold out</span>
          ) : selected ? (
            <>Subtotal {formatPrice(selected.price * quantity)}</>
          ) : null}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={() => addToCart(false)}
          disabled={pending || soldOut}
          className="hf-btn hf-btn-outline flex-1 py-3"
        >
          {pending ? "Adding…" : "Add to bag"}
        </button>
        <button
          type="button"
          onClick={() => addToCart(true)}
          disabled={pending || soldOut}
          className="hf-btn hf-btn-accent flex-1 py-3"
        >
          Buy now
        </button>
      </div>

      <div className="mt-2.5">
        <WishlistButton productId={productId} initial={wishlisted} variant="full" />
      </div>
    </div>
  );
}
