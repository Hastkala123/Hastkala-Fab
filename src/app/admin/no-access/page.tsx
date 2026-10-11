import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/server/auth/page-guard";

export const metadata: Metadata = { title: "No access" };

export default async function NoAccessPage() {
  await requireStaffPage();
  return (
    <div className="hf-card mx-auto max-w-lg p-8 text-center">
      <h1 className="font-display text-xl font-bold text-indigo-ink-950">You don&apos;t have access to that page</h1>
      <p className="mt-2 text-sm text-slate-600">
        Your staff role doesn&apos;t include it. Ask the owner to add the permission in Admin → Staff if you need it.
      </p>
      <Link href="/" className="hf-btn hf-btn-primary mt-6">
        Go to orders
      </Link>
    </div>
  );
}
