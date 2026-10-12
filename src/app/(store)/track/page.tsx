import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import TrackForm from "./TrackForm";

export const metadata: Metadata = {
  title: "Track Your Order",
  description: "Check the status of your Hastkala Fab order with your order number and the email or mobile number you ordered with.",
  alternates: { canonical: "/track" },
};

export const dynamic = "force-dynamic";

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const prefill = typeof params.order === "string" && /^HF-?\d{6,9}$/i.test(params.order) ? params.order.toUpperCase() : "";

  return (
    <div className="hf-container py-8 sm:py-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/track", label: "Track your order" }]} />
      <div className="mt-6 max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight text-indigo-ink-950 sm:text-4xl">Track your order</h1>
        <p className="mt-2 text-slate-600">
          Enter the order number from your confirmation (like HF-100001) and the email or mobile number you ordered with.
        </p>
        {user && (
          <p className="mt-3 rounded-lg bg-cotton-100 px-4 py-3 text-sm text-slate-700">
            You&apos;re signed in — all your orders, with full details, are in{" "}
            <Link href="/account/orders" className="hf-link font-semibold">My orders</Link>.
          </p>
        )}
        <div className="hf-card mt-6 p-5 sm:p-6">
          <TrackForm initialOrderNumber={prefill} />
        </div>
      </div>
    </div>
  );
}
