"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/money";
import { productPath } from "@/lib/routes";
import type { CartDisplay } from "@/lib/cart-types";
import { EmptyState } from "@/components/store/ProductGrid";

export default function CartView({ cart, isSignedIn }: { cart: CartDisplay; isSignedIn: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function updateQuantity(itemId: string, quantity: number) {
    setBusyId(itemId);
    const result = await apiRequest("/api/cart", { method: "PATCH", body: { itemId, quantity } });
    setBusyId(null);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    router.refresh();
  }

  async function removeItem(itemId: string, title: string) {
    setBusyId(itemId);
    const result = await apiRequest("/api/cart", { method: "DELETE", body: { itemId } });
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
          action={{ href: "/search", label: "Start shopping" }}
        />
      </div>
    );
  }

  const gst = cart.pricesIncludeTax ? "" : " + GST";
  const blocked = cart.issues.length > 0;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
      <div>
        {blocked && (
          <div role="alert" className="mb-5 rounded-card border border-madder-200 bg-madder-50 p-4">
            <p className="text-sm font-bold text-madder-800">Please fix before checkout</p>
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
              <li key={line.id} className="hf-card flex gap-4 p-3.5 sm:p-4" aria-busy={busy}>
                <Link
                  href={productPath(line.slug)}
                  className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-lg bg-cotton-100 sm:w-24"
                >
                  {line.imageUrl ? (
                    <Image src={line.imageUrl} alt={line.imageAlt} fill sizes="96px" className="object-cover" />
                  ) : (
                    <div className="h-full w-full bg-cotton-200" />
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="hf-clamp-2 text-sm font-semibold text-indigo-ink-900">
                        <Link href={productPath(line.slug)} className="hover:underline">
                          {line.title}
                        </Link>
                      </h2>
                      {line.variantLabel && <p className="mt-0.5 text-xs text-slate-500">{line.variantLabel}</p>}
                      {line.priceSource === "WHOLESALE" && (
                        <p className="mt-0.5 text-xs font-semibold text-madder-600">Wholesale price</p>
                      )}
                      {line.note && <p className="mt-0.5 text-xs text-turmeric-800">{line.note}</p>}
                      {line.issue && <p className="mt-1 text-xs font-semibold text-madder-700">{line.issue}</p>}
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
                      <span className="min-w-8 px-1 py-1.5 text-center text-sm font-semibold" aria-live="polite">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.id, line.quantity + 1)}
                        disabled={busy || line.quantity >= line.maxQuantity}
                        className="px-2.5 py-1.5 text-base leading-none text-indigo-ink-800 transition hover:bg-cotton-100 disabled:opacity-40"
                        aria-label={`Increase quantity of ${line.title}`}
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-indigo-ink-950">
                        {formatPrice(line.lineSubtotal)}
                        {gst}
                      </p>
                      {line.quantity > 1 && (
                        <p className="text-xs text-slate-400">
                          {formatPrice(line.unitPrice)}
                          {gst} each
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <Link href="/search" className="hf-link mt-6 inline-block text-sm font-semibold">
          ← Continue shopping
        </Link>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="hf-card p-5">
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">Order summary</h2>

          {cart.freeShipping && cart.freeShipping.remaining > 0 && (
            <div className="mt-3 rounded-lg bg-turmeric-50 px-3 py-2.5">
              <p className="text-xs font-medium text-turmeric-900">
                Add {formatPrice(cart.freeShipping.remaining)} more for free shipping
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-turmeric-200">
                <div
                  className="h-full rounded-full bg-turmeric-500 transition-all"
                  style={{
                    width: `${Math.min(100, ((cart.freeShipping.threshold - cart.freeShipping.remaining) / cart.freeShipping.threshold) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <CouponBox code={cart.couponCode} error={cart.couponError} isSignedIn={isSignedIn} />

          <OrderTotals cart={cart} />

          {isSignedIn ? (
            <Link
              href="/checkout"
              aria-disabled={blocked}
              tabIndex={blocked ? -1 : undefined}
              className={`hf-btn hf-btn-accent mt-5 w-full py-3 ${blocked ? "pointer-events-none opacity-50" : ""}`}
            >
              Proceed to checkout
            </Link>
          ) : (
            <>
              <Link href="/login?next=/checkout" className="hf-btn hf-btn-accent mt-5 w-full py-3">
                Sign in to checkout
              </Link>
              <p className="mt-2 text-center text-xs text-slate-500">Your bag is kept when you sign in.</p>
            </>
          )}

          <div className="mt-5 border-t border-cotton-300 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">We accept</p>
            <p className="mt-1.5 text-xs text-slate-600">
              UPI · Cards · Net banking{cart.cod.available ? " · Cash on delivery" : ""}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Totals block, shared by the bag and checkout. */
export function OrderTotals({ cart }: { cart: CartDisplay }) {
  return (
    <>
      <dl className="mt-4 space-y-2.5 text-sm">
        <Row
          label={`Items (${cart.itemCount})${cart.pricesIncludeTax ? "" : " before GST"}`}
          value={formatPrice(cart.itemsSubtotal)}
        />
        {cart.discountTotal > 0 && (
          <Row
            label={`Discount${cart.couponCode ? ` (${cart.couponCode})` : ""}`}
            value={`− ${formatPrice(cart.discountTotal)}`}
            accent
          />
        )}
        <Row label="Shipping" value={cart.shippingFee === 0 ? "Free" : formatPrice(cart.shippingFee)} />
        {cart.codFee > 0 && <Row label="Cash on delivery fee" value={formatPrice(cart.codFee)} />}
        {cart.giftWrapFee > 0 && <Row label="Gift wrap" value={formatPrice(cart.giftWrapFee)} />}
        {!cart.pricesIncludeTax && <Row label="GST" value={formatPrice(cart.taxTotal)} />}
        {cart.roundOff !== 0 && <Row label="Round off" value={formatPrice(cart.roundOff)} />}

        <div className="flex items-baseline justify-between border-t border-cotton-300 pt-3">
          <dt className="font-display text-base font-bold text-indigo-ink-950">Total</dt>
          <dd className="font-display text-xl font-bold text-indigo-ink-950">{formatPrice(cart.grandTotal)}</dd>
        </div>
      </dl>
      <p className="mt-1.5 text-xs text-slate-500">
        {cart.pricesIncludeTax
          ? `Includes ${formatPrice(cart.taxTotal)} GST.`
          : "Wholesale prices are before GST; GST is added above."}
      </p>
    </>
  );
}

function CouponBox({ code, error, isSignedIn }: { code: string | null; error: string | null; isSignedIn: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(next: string | null) {
    setPending(true);
    setMessage(null);
    const result = await apiRequest("/api/coupon", { body: { code: next } });
    setPending(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    toast(next ? `Coupon ${next.toUpperCase()} applied` : "Coupon removed", "success");
    setValue("");
    router.refresh();
  }

  if (!isSignedIn) {
    return <p className="mt-4 text-xs text-slate-500">Have a coupon? Sign in to use it at checkout.</p>;
  }

  if (code) {
    return (
      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-emerald-800">{code} applied</p>
          <button type="button" onClick={() => submit(null)} disabled={pending} className="text-xs font-semibold text-emerald-900 underline">
            Remove
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-madder-700">{error}</p>}
      </div>
    );
  }

  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) void submit(value.trim());
      }}
    >
      <label htmlFor="coupon" className="hf-label">
        Coupon code
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="coupon"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          maxLength={30}
          autoComplete="off"
          className="hf-input uppercase"
          aria-describedby={message ? "coupon-error" : undefined}
        />
        <button type="submit" disabled={pending || !value.trim()} className="hf-btn hf-btn-outline">
          {pending ? "…" : "Apply"}
        </button>
      </div>
      {message && (
        <p id="coupon-error" role="alert" className="mt-1.5 text-xs text-madder-700">
          {message}
        </p>
      )}
    </form>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-600">{label}</dt>
      <dd className={accent ? "font-semibold text-emerald-700" : "font-medium text-indigo-ink-900"}>{value}</dd>
    </div>
  );
}
