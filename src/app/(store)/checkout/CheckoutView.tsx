"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/money";
import { formatIndianMobile } from "@/lib/phone";
import { orderThankYouPath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { CartDisplay } from "@/lib/cart-types";
import AddressForm, { type AddressValues } from "@/components/store/AddressForm";
import { FormError } from "@/components/ui/Field";
import { useFinishPayment, usePayment } from "@/components/payments/usePayment";
import { OrderTotals } from "../cart/CartView";

const PAYMENT_METHODS = [
  { value: "UPI", label: "UPI", detail: "GPay, PhonePe, Paytm and more" },
  { value: "CARD", label: "Credit / debit card", detail: "Visa, Mastercard, RuPay" },
  { value: "NETBANKING", label: "Net banking", detail: "All major Indian banks" },
  { value: "COD", label: "Cash on delivery", detail: "Pay when it arrives" },
] as const;

type Method = (typeof PAYMENT_METHODS)[number]["value"];

export default function CheckoutView({
  online,
  cod,
  addresses,
  onlineAvailable,
}: {
  online: CartDisplay;
  cod: CartDisplay;
  addresses: AddressValues[];
  /** False when no gateway is set up or the owner switched online payment off. */
  onlineAvailable: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [addressId, setAddressId] = useState<string | null>(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null,
  );
  const [showAddressForm, setShowAddressForm] = useState(addresses.length === 0);
  const [paymentMethod, setPaymentMethod] = useState<Method>(onlineAvailable ? "UPI" : "COD");
  const { pay, dialog } = usePayment();
  const finishPayment = useFinishPayment("checkout");
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // One key per visit to this page: a double click or a retried request
  // returns the same order instead of creating a second one.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const cart = paymentMethod === "COD" ? cod : online;
  const blocked = cart.issues.length > 0;

  async function placeOrder() {
    if (placing) return;
    if (!addressId) {
      setFormError("Please add a delivery address.");
      return;
    }
    setPlacing(true);
    setFormError(null);

    const result = await apiRequest<{ orderNumber: string; status: string }>("/api/checkout", {
      body: { addressId, paymentMethod, customerNote: note, idempotencyKey },
    });
    if (!result.ok) {
      setPlacing(false);
      setFormError(result.error);
      router.refresh();
      return;
    }
    const { orderNumber, status } = result.data;
    if (status === "PENDING_PAYMENT") {
      // The order holds the stock; now take the payment.
      await finishPayment(orderNumber, await pay(orderNumber));
      return;
    }
    toast("Order placed", "success");
    router.replace(orderThankYouPath(orderNumber));
    router.refresh();
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-10">
      <div className="space-y-6">
        <section className="hf-card p-5" aria-labelledby="step-address">
          <div className="flex items-center justify-between gap-3">
            <h2 id="step-address" className="font-display text-lg font-bold text-indigo-ink-950">
              <span className="mr-2 text-madder-600">1.</span>Delivery address
            </h2>
            {addresses.length > 0 && !showAddressForm && (
              <button type="button" onClick={() => setShowAddressForm(true)} className="hf-link text-sm font-semibold">
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
                      addressId === address.id ? "border-indigo-ink-700 bg-indigo-ink-50" : "border-cotton-300 hover:border-cotton-400",
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
                          {address.label}
                        </span>
                        {address.isDefault && (
                          <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                            Default
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-slate-600">
                        {[address.line1, address.line2, address.landmark, address.city].filter(Boolean).join(", ")},{" "}
                        {address.state} {address.pincode}
                      </p>
                      <p className="mt-0.5 text-slate-500">Phone: {formatIndianMobile(address.phone)}</p>
                      {address.gstin && <p className="mt-0.5 text-slate-500">GSTIN: {address.gstin}</p>}
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {showAddressForm && (
            <div className="mt-4 rounded-lg border border-cotton-300 bg-cotton-50 p-4">
              <h3 className="mb-3 text-sm font-bold text-indigo-ink-900">New delivery address</h3>
              <AddressForm
                onDone={() => setShowAddressForm(false)}
                onCancel={addresses.length > 0 ? () => setShowAddressForm(false) : undefined}
              />
            </div>
          )}
        </section>

        <section className="hf-card p-5" aria-labelledby="step-payment">
          <h2 id="step-payment" className="font-display text-lg font-bold text-indigo-ink-950">
            <span className="mr-2 text-madder-600">2.</span>Payment method
          </h2>

          <ul className="mt-4 space-y-2.5">
            {PAYMENT_METHODS.map((method) => {
              const disabled = method.value === "COD" ? !cod.cod.available : !onlineAvailable;
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
                          ? method.value === "COD"
                            ? cod.cod.reason
                            : "Online payment is unavailable right now"
                          : method.value === "COD" && cod.codFee > 0
                            ? `${method.detail} · ${formatPrice(cod.codFee)} fee`
                            : method.detail}
                      </p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="hf-card p-5" aria-labelledby="step-review">
          <h2 id="step-review" className="font-display text-lg font-bold text-indigo-ink-950">
            <span className="mr-2 text-madder-600">3.</span>Review your items
          </h2>

          <ul className="mt-4 divide-y divide-cotton-200">
            {cart.lines.map((line) => (
              <li key={line.id} className="flex gap-3 py-3">
                <div className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded bg-cotton-100">
                  {line.imageUrl && <Image src={line.imageUrl} alt={line.imageAlt} fill sizes="56px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="hf-clamp-2 font-medium text-indigo-ink-900">{line.title}</p>
                  {line.variantLabel && <p className="text-xs text-slate-500">{line.variantLabel}</p>}
                  <p className="text-xs text-slate-500">Qty {line.quantity}</p>
                  {line.issue && <p className="mt-0.5 text-xs font-semibold text-madder-700">{line.issue}</p>}
                </div>
                <p className="text-sm font-semibold text-indigo-ink-950">
                  {formatPrice(line.lineSubtotal)}
                  {cart.pricesIncludeTax ? "" : " + GST"}
                </p>
              </li>
            ))}
          </ul>

          <label htmlFor="order-note" className="hf-label mt-4">
            Note for us (optional)
          </label>
          <textarea
            id="order-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Delivery instructions, gift note…"
            className="hf-input mt-1"
          />
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="hf-card p-5">
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">Order summary</h2>
          {cart.couponCode ? (
            <p className="mt-3 text-sm text-emerald-700">
              Coupon <strong>{cart.couponCode}</strong> applied.{" "}
              <Link href="/cart" className="hf-link">
                Change
              </Link>
            </p>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              Have a coupon?{" "}
              <Link href="/cart" className="hf-link">
                Apply it in your bag
              </Link>
              .
            </p>
          )}

          <OrderTotals cart={cart} />

          {blocked && (
            <ul role="alert" className="mt-4 space-y-1 rounded-lg bg-madder-50 p-3 text-xs text-madder-800">
              {cart.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}

          <div className="mt-5">
            <FormError message={formError} />
          </div>

          <button
            type="button"
            onClick={placeOrder}
            disabled={placing || !addressId || blocked || (paymentMethod === "COD" ? !cod.cod.available : !onlineAvailable)}
            className="hf-btn hf-btn-accent mt-3 w-full py-3"
          >
            {placing
              ? "Placing your order…"
              : paymentMethod === "COD"
                ? `Place order · ${formatPrice(cart.grandTotal)}`
                : `Place order and pay · ${formatPrice(cart.grandTotal)}`}
          </button>
          {dialog}

          <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
            By placing this order you agree to our{" "}
            <Link href="/terms" className="hf-link">
              Terms
            </Link>
            ,{" "}
            <Link href="/returns-policy" className="hf-link">
              Returns Policy
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" className="hf-link">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </aside>
    </div>
  );
}
