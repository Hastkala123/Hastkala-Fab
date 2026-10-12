import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/routes";
import { formatIndianMobile } from "@/lib/phone";
import AccountNav from "./AccountNav";

/**
 * Every /account/* route is gated here, in a server component that runs before
 * any child renders. This is the real authorisation boundary — not the proxy,
 * which is deliberately security-neutral.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    // Back to the exact page after sign-in (the proxy sets x-pathname).
    const path = (await headers()).get("x-pathname");
    const next = path?.startsWith("/account") ? safeRedirectPath(path) : "/account";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="hf-container py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[240px_1fr] lg:gap-12 print:block">
        <aside className="print:hidden">
          <div className="hf-card p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-indigo-ink-800 font-display text-lg font-bold text-cotton-50">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-indigo-ink-950">
                  {user.name}
                </p>
                <p className="truncate text-xs text-slate-500">{user.email ?? (user.phone ? formatIndianMobile(user.phone) : "")}</p>
              </div>
            </div>

            {user.wholesaleStatus && (
              <p
                className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
                  user.wholesaleStatus === "APPROVED"
                    ? "bg-emerald-50 text-emerald-800"
                    : user.wholesaleStatus === "PENDING"
                      ? "bg-turmeric-50 text-turmeric-900"
                      : "bg-madder-50 text-madder-800"
                }`}
              >
                {user.wholesaleStatus === "APPROVED"
                  ? "✓ Wholesale account approved — trade prices are on"
                  : user.wholesaleStatus === "PENDING"
                    ? "⏳ We're checking your business details"
                    : "Wholesale account not active — see Wholesale account"}
              </p>
            )}

            {user.isStaff && (
              <Link
                href="/admin"
                className="hf-btn hf-btn-primary mt-3 w-full py-2 text-sm"
              >
                Admin dashboard
              </Link>
            )}
          </div>

          <AccountNav wholesaleStatus={user.wholesaleStatus} />
        </aside>

        <div>{children}</div>
      </div>
    </div>
  );
}
