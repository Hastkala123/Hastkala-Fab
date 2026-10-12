"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/account", label: "Profile", exact: true },
  { href: "/account/orders", label: "My orders" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/support", label: "Support tickets" },
  { href: "/account/security", label: "Password & security" },
];

const WHOLESALE_LINKS = [
  { href: "/account/wholesale/quick-order", label: "Quick order" },
  { href: "/account/wholesale/catalogue", label: "Catalogue & prices" },
  { href: "/account/wholesale/ledger", label: "Account statement" },
];

export default function AccountNav({ wholesaleStatus }: { wholesaleStatus: string | null }) {
  const pathname = usePathname();
  const links = [
    ...LINKS.slice(0, 2),
    { href: "/account/wholesale", label: wholesaleStatus ? "Wholesale account" : "Apply for wholesale", exact: true },
    ...(wholesaleStatus === "APPROVED" ? WHOLESALE_LINKS : []),
    ...LINKS.slice(2),
  ];
  const router = useRouter();

  async function logout() {
    await apiRequest("/api/auth/logout");
    router.push("/");
    router.refresh();
  }

  return (
    <nav aria-label="Account navigation" className="mt-4">
      <ul className="space-y-0.5">
        {links.map((link) => {
          const active = "exact" in link && link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-lg px-3.5 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-indigo-ink-800 text-white"
                    : "text-slate-600 hover:bg-cotton-200 hover:text-indigo-ink-900",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
        <li className="pt-2">
          <button
            type="button"
            onClick={logout}
            className="block w-full rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-madder-600 transition hover:bg-madder-50"
          >
            Sign out
          </button>
        </li>
      </ul>
    </nav>
  );
}
