import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdminRole } from "@/lib/auth";
import AdminNav from "./AdminNav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Hastkala Fab Admin" },
  // The admin portal must never be indexed, cached or previewed by a crawler.
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

/**
 * The single authorisation gate for the entire admin portal.
 *
 * Because this is a server component in the layout, it runs before any admin
 * page renders and cannot be skipped by a crafted request header — unlike
 * middleware-based checks. Every admin API route repeats the check
 * independently, so neither layer is a single point of failure.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login?next=/admin");
  if (!isAdminRole(user.role)) {
    // A signed-in non-admin is sent to their own account rather than shown a
    // 403, so the portal's existence is not confirmed to a curious customer.
    redirect("/account");
  }

  return (
    <div className="flex min-h-screen flex-col bg-cotton-100">
      <header className="sticky top-0 z-40 border-b border-indigo-ink-800 bg-indigo-ink-900">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-cotton-50 text-indigo-ink-900">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                <path d="M12 3.2c1.9 2 3 3.6 3 5.3 0 1.7-1.3 3-3 3s-3-1.3-3-3c0-1.7 1.1-3.3 3-5.3Z" fill="currentColor" />
                <path d="M12 20.8c-1.9-2-3-3.6-3-5.3 0-1.7 1.3-3 3-3s3 1.3 3 3c0 1.7-1.1 3.3-3 5.3Z" fill="currentColor" opacity=".6" />
              </svg>
            </span>
            <span className="font-display text-base font-bold text-cotton-50">
              Hastkala Fab
              <span className="ml-1.5 rounded bg-madder-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                Admin
              </span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden text-sm text-cotton-300 transition hover:text-cotton-50 sm:block"
            >
              View store ↗
            </Link>
            <div className="flex items-center gap-2 rounded-lg bg-indigo-ink-800 px-3 py-1.5">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-turmeric-500 text-xs font-bold text-indigo-ink-950">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <div className="hidden leading-tight sm:block">
                <p className="text-xs font-semibold text-cotton-50">{user.name}</p>
                <p className="text-[10px] text-cotton-300">{user.role}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-6 px-4 py-6 sm:px-6">
        <AdminNav isSuperAdmin={user.role === "SUPERADMIN"} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
