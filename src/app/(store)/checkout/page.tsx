import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCartView, toCartDisplay } from "@/server/cart";
import CheckoutView from "./CheckoutView";
import { EmptyState } from "@/components/store/ProductGrid";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Hastkala Fab order.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  // Server-side gate: the browser never decides whether checkout is reachable.
  if (!user) redirect("/login?next=/checkout");

  // Totals for each way of paying (COD may add a fee), computed on the server.
  const [online, cod, addresses] = await Promise.all([
    getCartView({ paymentMethod: "ONLINE" }).then(toCartDisplay),
    getCartView({ paymentMethod: "COD" }).then(toCartDisplay),
    db.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  if (online.lines.length === 0) {
    return (
      <div className="hf-container py-12">
        <EmptyState
          title="Nothing to check out"
          message="Your bag is empty. Add something from the collection first."
          action={{ href: "/search", label: "Browse the collection" }}
        />
      </div>
    );
  }

  return (
    <div className="hf-container py-8 sm:py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-indigo-ink-950">Checkout</h1>
        <Link href="/cart" className="hf-link text-sm font-semibold">
          ← Back to bag
        </Link>
      </div>

      <CheckoutView
        online={online}
        cod={cod}
        addresses={addresses.map((a) => ({
          id: a.id,
          fullName: a.fullName,
          phone: a.phone,
          line1: a.line1,
          line2: a.line2,
          landmark: a.landmark,
          city: a.city,
          state: a.state,
          pincode: a.pincode,
          gstin: a.gstin,
          label: a.label,
          isDefault: a.isDefault,
        }))}
      />
    </div>
  );
}
