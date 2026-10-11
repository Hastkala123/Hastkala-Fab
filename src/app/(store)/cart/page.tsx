import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getCartView, toCartDisplay } from "@/server/cart";
import CartView from "./CartView";

export const metadata: Metadata = {
  title: "Your Shopping Bag",
  description: "Review the items in your Hastkala Fab shopping bag before checkout.",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [view, user] = await Promise.all([getCartView(), getCurrentUser()]);
  const cart = await toCartDisplay(view);

  return (
    <div className="hf-container py-8 sm:py-12">
      <h1 className="font-display text-3xl font-bold tracking-tight text-indigo-ink-950">Your bag</h1>
      <p className="mt-1.5 text-sm text-slate-600">
        {cart.itemCount === 0 ? "Nothing here yet." : `${cart.itemCount} ${cart.itemCount === 1 ? "item" : "items"}`}
      </p>

      <CartView cart={cart} isSignedIn={Boolean(user)} />
    </div>
  );
}
