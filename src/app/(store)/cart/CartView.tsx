"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatPrice, FREE_SHIPPING_THRESHOLD } from "@/lib/money";
import type { CartSummary } from "@/lib/cart";
import { EmptyState } from "@/components/store/ProductGrid";

export default function CartView({
  cart,
  isSignedIn,
}: {
  cart: CartSummary;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function updateQuantity(cartItemId: string, quantity: number) {
    setBusyId(cartItemId);
    const result = await apiRequest("/api/cart", {
      method: "PATCH",
      body: { cartItemId, quantity },
    });
    setBusyId(null);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    router.refresh();
  }

  async function removeItem(cartItemId: string, title: string) {
    setBusyId(cartItemId);
    const result = await apiRequest("/api/cart", {
      method: "DELETE",
      body: { cartItemId },
    });
    setBusyId(null);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`${title} removed from your bag`, "success");
    router.refresh();
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          title="Your bag is empty"
          message="Browse our Sanganeri collection and add something you love."
          action={{ href: "/products", label: "Start shopping" }}
        />
      </div>
    );
  }

  const awayFromFreeShipping = Math.max(
    0,
    FREE_SHIPPING_THRESHOLD - (cart.subtotal - cart.discount),
  );

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
      <div>
        {cart.issues.length > 0 && (
          <div
            role="alert"
            className="mb-5 rounded-card border border-madder-200 bg-madder-50 p-4"
          >
            <p className="text-sm font-bold text-madder-800">
              Please resolve before checkout
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-madder-700">
              {cart.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        <ul className="space-y-4">
          {cart.lines.map((line) => {
            const busy = busyId === line.id;
            return (
              <li
                key={line.id}
                className="hf-card flex gap-4 p-3.5 sm:p-4"
                aria-busy={busy}
              >
                <Link
                  href={`/product/${line.slug}`}
                  className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-lg bg-cotton-100 sm:w-24"
                >
                  {line.image ? (
                    <Image
                      src={line.image}
                      alt={line.title}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-cotton-200" />
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="hf-clamp-2 text-sm font-semibold text-indigo-ink-900">
                        <Link href={`/product/${line.slug}`} className="hover:underline">
                          {line.title}
                        </Link>
                      </h2>
                      {line.variantLabel && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {line.variantLabel}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-slate-400">SKU {line.sku}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(line.id, line.title)}
                      disabled={busy}
                      className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-madder-50 hover:text-madder-600 disabled:opacity-50"
                      aria-label={`Remove ${line.title} from bag`}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
                    <div className="flex items-center rounded-lg border border-cotton-400">
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.id, line.quantity - 1)}
                        disabled={busy || line.quantity <= 1}
                        className="px-2.5 py-1.5 text-base leading-none text-indigo-ink-800 transition hover:bg-cotton-100 disabled:opacity-40"
                        aria-label={`Decrease quantity of ${line.title}`}
                      >
                        −
                      </button>
                      <span className="min-w-8 px-1 py-1.5 text-center text-sm font-semibold">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.id, line.quantity + 1)}
                        disabled={busy || line.quantity >= line.availableStock}
                        className="px-2.5 py-1.5 text-base leading-none text-indigo-ink-800 transition hover:bg-cotton-100 disabled:opacity-40"
                        aria-label={`Increase quantity of ${line.title}`}
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-indigo-ink-950">
                        {formatPrice(line.lineTotal)}
                      </p>
                      {line.quantity > 1 && (
                        <p className="text-xs text-slate-400">
                          {formatPrice(line.unitPrice)} each
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <Link href="/products" className="hf-link mt-6 inline-block text-sm font-semibold">
          ← Continue shopping
        </Link>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="hf-card p-5">
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">
            Order summary
          </h2>

          {awayFromFreeShipping > 0 && cart.orderType === "RETAIL" && (
            <div className="mt-3 rounded-lg bg-turmeric-50 px-3 py-2.5">
              <p className="text-xs font-medium text-turmeric-900">
                Add {formatPrice(awayFromFreeShipping)} more for free shipping
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-turmeric-200">
                <div
                  className="h-full rounded-full bg-turmeric-500 transition-all"
                  style={{
                    width: `${Math.min(100, ((cart.subtotal - cart.discount) / FREE_SHIPPING_THRESHOLD) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <dl className="mt-4 space-y-2.5 text-sm">
            <Row label={`Subtotal (${cart.itemCount} items)`} value={formatPrice(cart.subtotal)} />
            {cart.discount > 0 && (
              <Row
                label={`Discount${cart.couponCode ? ` (${cart.couponCode})` : ""}`}
                value={`− ${formatPrice(cart.discount)}`}
                accent
              />
            )}
            <Row
              label="Shipping"
              value={cart.shippingFee === 0 ? "Free" : formatPrice(cart.shippingFee)}
            />
            <Row label="GST" value={formatPrice(cart.tax)} />

            <div className="flex items-baseline justify-between border-t border-cotton-300 pt-3">
              <dt className="font-display text-base font-bold text-indigo-ink-950">
                Total
              </dt>
              <dd className="font-display text-xl font-bold text-indigo-ink-950">
                {formatPrice(cart.total)}
              </dd>
            </div>
          </dl>

          <p className="mt-1.5 text-xs text-slate-500">
            Inclusive of all taxes. Shipping calculated for delivery within India.
          </p>

          {isSignedIn ? (
            <Link
              href="/checkout"
              aria-disabled={cart.issues.length > 0}
              className={`hf-btn hf-btn-accent mt-5 w-full py-3 ${
                cart.issues.length > 0 ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Proceed to checkout
            </Link>
          ) : (
            <>
              <Link href="/login?next=/checkout" className="hf-btn hf-btn-accent mt-5 w-full py-3">
                Sign in to checkout
              </Link>
              <p className="mt-2 text-center text-xs text-slate-500">
                Your bag will be saved when you sign in.
              </p>
            </>
          )}

          <div className="mt-5 border-t border-cotton-300 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              We accept
            </p>
            <p className="mt-1.5 text-xs text-slate-600">
              UPI · Visa · Mastercard · RuPay · Net banking · Cash on Delivery
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-600">{label}</dt>
      <dd className={accent ? "font-semibold text-emerald-700" : "font-medium text-indigo-ink-900"}>
        {value}
      </dd>
    </div>
  );
}
