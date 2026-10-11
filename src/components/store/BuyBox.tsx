"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import WishlistButton from "./WishlistButton";

type Variant = {
  id: string;
  size: string | null;
  color: string | null;
  stock: number;
  priceDelta: number;
};

export default function BuyBox({
  productId,
  productTitle,
  stock,
  minQty,
  variants,
  basePrice,
  wishlisted,
}: {
  productId: string;
  productTitle: string;
  stock: number;
  minQty: number;
  variants: Variant[];
  basePrice: number;
  wishlisted: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [variantId, setVariantId] = useState<string | null>(
    // Preselect if there is exactly one in-stock option — one less tap.
    variants.filter((v) => v.stock > 0).length === 1
      ? (variants.find((v) => v.stock > 0)?.id ?? null)
      : null,
  );
  const [quantity, setQuantity] = useState(minQty);
  const [pending, setPending] = useState(false);

  const sizes = useMemo(
    () => variants.filter((v) => v.size).map((v) => ({ ...v, label: v.size! })),
    [variants],
  );
  const colours = useMemo(
    () => variants.filter((v) => !v.size && v.color).map((v) => ({ ...v, label: v.color! })),
    [variants],
  );

  const selected = variants.find((v) => v.id === variantId) ?? null;
  const effectiveStock = selected ? selected.stock : stock;
  const effectivePrice = basePrice + (selected?.priceDelta ?? 0);
  const outOfStock = effectiveStock <= 0;
  const needsChoice = variants.length > 0 && !variantId;

  const maxQty = Math.min(effectiveStock, 100);

  async function addToCart(thenGoToCart: boolean) {
    if (pending) return;

    if (needsChoice) {
      toast(
        sizes.length > 0 ? "Please select a size first." : "Please select an option first.",
        "error",
      );
      return;
    }

    setPending(true);
    const result = await apiRequest<{ itemCount: number }>("/api/cart", {
      body: { productId, variantId: variantId ?? "", quantity },
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

  return (
    <div className="mt-6">
      {sizes.length > 0 && (
        <fieldset className="mb-5">
          <legend className="hf-label">
            Select size{" "}
            {needsChoice && <span className="font-normal text-madder-600">— required</span>}
          </legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {sizes.map((variant) => {
              const disabled = variant.stock <= 0;
              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setVariantId(variant.id);
                    setQuantity(Math.min(minQty, variant.stock) || 1);
                  }}
                  aria-pressed={variantId === variant.id}
                  className={cn(
                    "min-w-12 rounded-lg border-2 px-3.5 py-2 text-sm font-semibold transition",
                    disabled &&
                      "cursor-not-allowed border-cotton-200 text-cotton-400 line-through",
                    !disabled && variantId === variant.id
                      ? "border-indigo-ink-800 bg-indigo-ink-800 text-white"
                      : !disabled &&
                          "border-cotton-300 text-indigo-ink-800 hover:border-indigo-ink-500",
                  )}
                >
                  {variant.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {colours.length > 0 && (
        <fieldset className="mb-5">
          <legend className="hf-label">
            Select colour{" "}
            {needsChoice && <span className="font-normal text-madder-600">— required</span>}
          </legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {colours.map((variant) => {
              const disabled = variant.stock <= 0;
              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setVariantId(variant.id);
                    setQuantity(Math.min(minQty, variant.stock) || 1);
                  }}
                  aria-pressed={variantId === variant.id}
                  className={cn(
                    "rounded-lg border-2 px-3.5 py-2 text-sm font-medium transition",
                    disabled &&
                      "cursor-not-allowed border-cotton-200 text-cotton-400 line-through",
                    !disabled && variantId === variant.id
                      ? "border-indigo-ink-800 bg-indigo-ink-800 text-white"
                      : !disabled &&
                          "border-cotton-300 text-indigo-ink-800 hover:border-indigo-ink-500",
                  )}
                >
                  {variant.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {selected && selected.priceDelta !== 0 && (
        <p className="mb-4 text-sm font-medium text-indigo-ink-800">
          Price for this option: {formatPrice(effectivePrice)}
        </p>
      )}

      {minQty > 1 && (
        <p className="mb-3 rounded-lg bg-madder-50 px-3 py-2 text-xs font-medium text-madder-800">
          Wholesale minimum order: {minQty} units
        </p>
      )}

      {!outOfStock && effectiveStock <= 5 && (
        <p className="mb-3 text-sm font-semibold text-madder-600">
          Only {effectiveStock} left in stock
        </p>
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-cotton-400">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(minQty, q - 1))}
            disabled={quantity <= minQty || outOfStock}
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
            value={quantity}
            min={minQty}
            max={maxQty}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isNaN(next)) return;
              setQuantity(Math.max(minQty, Math.min(maxQty, next)));
            }}
            className="w-14 border-x border-cotton-300 py-2.5 text-center text-sm font-semibold text-indigo-ink-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
            disabled={quantity >= maxQty || outOfStock}
            className="px-3.5 py-2.5 text-lg leading-none text-indigo-ink-800 transition hover:bg-cotton-100 disabled:opacity-40"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <p className="text-sm text-slate-500">
          {outOfStock ? (
            <span className="font-semibold text-madder-600">Out of stock</span>
          ) : (
            <>Subtotal {formatPrice(effectivePrice * quantity)}</>
          )}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={() => addToCart(false)}
          disabled={pending || outOfStock}
          className="hf-btn hf-btn-outline flex-1 py-3"
        >
          {pending ? "Adding…" : "Add to bag"}
        </button>
        <button
          type="button"
          onClick={() => addToCart(true)}
          disabled={pending || outOfStock}
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
