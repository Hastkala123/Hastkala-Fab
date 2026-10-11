import type { Metadata } from "next";
import { getCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth";
import CartView from "./CartView";

export const metadata: Metadata = {
  title: "Your Shopping Bag",
  description: "Review the items in your Hastkala Fab shopping bag before checkout.",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [cart, user] = await Promise.all([getCart(), getCurrentUser()]);

  return (
    <div className="hf-container py-8 sm:py-12">
      <h1 className="font-display text-3xl font-bold tracking-tight text-indigo-ink-950">
        Your bag
      </h1>
      <p className="mt-1.5 text-sm text-slate-600">
        {cart.itemCount === 0
          ? "Nothing here yet."
          : `${cart.itemCount} ${cart.itemCount === 1 ? "item" : "items"}`}
      </p>

      <CartView cart={cart} isSignedIn={Boolean(user)} />
    </div>
  );
}
