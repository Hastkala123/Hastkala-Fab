"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CartSummary } from "@/lib/cart";
import AddressForm, { type AddressValues } from "@/components/store/AddressForm";
import { FormError } from "@/components/ui/Field";

const PAYMENT_METHODS = [
  { value: "UPI", label: "UPI", detail: "GPay, PhonePe, Paytm & more" },
  { value: "CARD", label: "Credit / Debit card", detail: "Visa, Mastercard, RuPay" },
  { value: "NETBANKING", label: "Net banking", detail: "All major Indian banks" },
  { value: "COD", label: "Cash on Delivery", detail: "Pay when it arrives" },
] as const;

export default function CheckoutView({
  cart,
  addresses,
}: {
  cart: CartSummary;
  addresses: AddressValues[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [addressId, setAddressId] = useState<string | null>(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null,
  );
  const [showAddressForm, setShowAddressForm] = useState(addresses.length === 0);
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof PAYMENT_METHODS)[number]["value"]>("UPI");

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponPending, setCouponPending] = useState(false);

  const [placing, setPlacing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Mirrors the server's arithmetic so the displayed total matches what the
  // checkout endpoint will independently recompute.
  const discount = coupon?.discount ?? 0;
  const discountedSubtotal = cart.subtotal - discount;
  const shippingFee =
    cart.orderType === "WHOLESALE" ? 0 : discountedSubtotal >= 99900 ? 0 : 7900;
  const total = discountedSubtotal + shippingFee + cart.tax;

  const codBlocked = paymentMethod === "COD" && total > 1_000_000;

  async function applyCoupon(event: React.FormEvent) {
    event.preventDefault();
    if (couponPending || !couponInput.trim()) return;

    setCouponPending(true);
    setCouponError(null);

    const result = await apiRequest<{ code: string; discount: number }>("/api/coupon", {
      body: { code: couponInput.trim().toUpperCase() },
    });

    setCouponPending(false);

    if (!result.ok) {
      setCouponError(result.error);
      setCoupon(null);
      return;
    }

    setCoupon({ code: result.data.code, discount: result.data.discount });
    toast(`Coupon ${result.data.code} applied`, "success");
  }

  async function placeOrder() {
    if (placing) return;

    if (!addressId) {
      setFormError("Please add a delivery address.");
      return;
    }
    if (codBlocked) {
      setFormError("Cash on Delivery is not available on orders above ₹10,000.");
      return;
    }

    setPlacing(true);
    setFormError(null);

    const result = await apiRequest<{ orderNumber: string }>("/api/checkout", {
      body: {
        addressId,
        paymentMethod,
        couponCode: coupon?.code ?? "",
        customerNote: "",
      },
    });

    if (!result.ok) {
      setPlacing(false);
      setFormError(result.error);
      return;
    }

    toast("Order placed successfully", "success");
    router.replace(`/order-confirmed/${result.data.orderNumber}`);
    router.refresh();
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-10">
      <div className="space-y-6">
        {/* ---------- Address ---------- */}
        <section className="hf-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-indigo-ink-950">
              <span className="mr-2 text-madder-600">1.</span>Delivery address
            </h2>
            {addresses.length > 0 && !showAddressForm && (
              <button
                type="button"
                onClick={() => setShowAddressForm(true)}
                className="hf-link text-sm font-semibold"
              >
                + Add new
              </button>
            )}
          </div>

          {addresses.length > 0 && (
            <ul className="mt-4 space-y-2.5">
              {addresses.map((address) => (
                <li key={address.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-lg border-2 p-3.5 transition",
                      addressId === address.id
                        ? "border-indigo-ink-700 bg-indigo-ink-50"
                        : "border-cotton-300 hover:border-cotton-400",
                    )}
                  >
                    <input
                      type="radio"
                      name="address"
                      value={address.id}
                      checked={addressId === address.id}
                      onChange={() => setAddressId(address.id!)}
                      className="mt-1 h-4 w-4 shrink-0 accent-indigo-ink-800"
                    />
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-indigo-ink-900">
                        {address.fullName}
                        <span className="ml-2 rounded bg-cotton-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                          {address.type}
                        </span>
                        {address.isDefault && (
                          <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                            Default
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-slate-600">
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ""}, {address.city},{" "}
                        {address.state} {address.pincode}
                      </p>
                      <p className="mt-0.5 text-slate-500">Phone: {address.phone}</p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {showAddressForm && (
            <div className="mt-4 rounded-lg border border-cotton-300 bg-cotton-50 p-4">
              <h3 className="mb-3 text-sm font-bold text-indigo-ink-900">
                New delivery address
              </h3>
              <AddressForm
                onDone={() => setShowAddressForm(false)}
                onCancel={
                  addresses.length > 0 ? () => setShowAddressForm(false) : undefined
                }
              />
            </div>
          )}
        </section>

        {/* ---------- Payment ---------- */}
        <section className="hf-card p-5">
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">
            <span className="mr-2 text-madder-600">2.</span>Payment method
          </h2>

          <ul className="mt-4 space-y-2.5">
            {PAYMENT_METHODS.map((method) => {
              const disabled = method.value === "COD" && total > 1_000_000;
              return (
                <li key={method.value}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3.5 transition",
                      disabled && "cursor-not-allowed opacity-50",
                      paymentMethod === method.value && !disabled
                        ? "border-indigo-ink-700 bg-indigo-ink-50"
                        : "border-cotton-300 hover:border-cotton-400",
                    )}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={method.value}
                      checked={paymentMethod === method.value}
                      disabled={disabled}
                      onChange={() => setPaymentMethod(method.value)}
                      className="h-4 w-4 shrink-0 accent-indigo-ink-800"
                    />
                    <div className="text-sm">
                      <p className="font-semibold text-indigo-ink-900">{method.label}</p>
                      <p className="text-xs text-slate-500">
                        {disabled
                          ? "Not available above ₹10,000"
                          : method.detail}
                      </p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          {paymentMethod !== "COD" && (
            <p className="mt-4 rounded-lg bg-turmeric-50 px-3.5 py-2.5 text-xs text-turmeric-900">
              <strong>Note:</strong> the payment gateway is not yet connected on this
              installation. Your order will be recorded with payment status
              <em> pending</em>, and our team will send you a secure payment link.
            </p>
          )}
        </section>

        {/* ---------- Review ---------- */}
        <section className="hf-card p-5">
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">
            <span className="mr-2 text-madder-600">3.</span>Review your items
          </h2>

          <ul className="mt-4 divide-y divide-cotton-200">
            {cart.lines.map((line) => (
              <li key={line.id} className="flex gap-3 py-3">
                <div className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded bg-cotton-100">
                  {line.image && (
                    <Image
                      src={line.image}
                      alt={line.title}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="hf-clamp-2 font-medium text-indigo-ink-900">
                    {line.title}
                  </p>
                  {line.variantLabel && (
                    <p className="text-xs text-slate-500">{line.variantLabel}</p>
                  )}
                  <p className="text-xs text-slate-500">Qty {line.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-indigo-ink-950">
                  {formatPrice(line.lineTotal)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ---------- Summary ---------- */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="hf-card p-5">
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">
            Order summary
          </h2>

          <form onSubmit={applyCoupon} className="mt-4">
            <label htmlFor="coupon" className="hf-label">
              Coupon code
            </label>
            <div className="flex gap-2">
              <input
                id="coupon"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="WELCOME10"
                maxLength={30}
                className="hf-input uppercase"
                aria-invalid={Boolean(couponError)}
              />
              <button
                type="submit"
                disabled={couponPending || !couponInput.trim()}
                className="hf-btn hf-btn-outline shrink-0"
              >
                {couponPending ? "…" : "Apply"}
              </button>
            </div>
            {couponError && (
              <p role="alert" className="mt-1 text-xs font-medium text-madder-600">
                {couponError}
              </p>
            )}
            {coupon && (
              <p className="mt-1 flex items-center gap-2 text-xs font-medium text-emerald-700">
                ✓ {coupon.code} applied
                <button
                  type="button"
                  onClick={() => {
                    setCoupon(null);
                    setCouponInput("");
                  }}
                  className="text-slate-400 underline hover:text-madder-600"
                >
                  remove
                </button>
              </p>
            )}
          </form>

          <dl className="mt-5 space-y-2.5 border-t border-cotton-300 pt-4 text-sm">
            <Row label={`Subtotal (${cart.itemCount} items)`} value={formatPrice(cart.subtotal)} />
            {discount > 0 && (
              <Row label="Coupon discount" value={`− ${formatPrice(discount)}`} accent />
            )}
            <Row
              label="Shipping"
              value={shippingFee === 0 ? "Free" : formatPrice(shippingFee)}
            />
            <Row label="GST" value={formatPrice(cart.tax)} />

            <div className="flex items-baseline justify-between border-t border-cotton-300 pt-3">
              <dt className="font-display text-base font-bold text-indigo-ink-950">
                Total payable
              </dt>
              <dd className="font-display text-xl font-bold text-indigo-ink-950">
                {formatPrice(total)}
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <FormError message={formError} />
          </div>

          <button
            type="button"
            onClick={placeOrder}
            disabled={placing || !addressId || codBlocked}
            className="hf-btn hf-btn-accent mt-3 w-full py-3"
          >
            {placing ? "Placing your order…" : `Place order · ${formatPrice(total)}`}
          </button>

          <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
            By placing this order you agree to our{" "}
            <a href="/terms" className="hf-link">
              Terms
            </a>
            ,{" "}
            <a href="/returns-policy" className="hf-link">
              Returns Policy
            </a>{" "}
            and{" "}
            <a href="/privacy-policy" className="hf-link">
              Privacy Policy
            </a>
            . A GST invoice will be emailed to you.
          </p>
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
