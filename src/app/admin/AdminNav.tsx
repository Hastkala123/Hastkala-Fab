"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const SECTIONS = [
  {
    title: "Overview",
    links: [{ href: "/admin", label: "Dashboard", exact: true }],
  },
  {
    title: "Catalogue",
    links: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/categories", label: "Categories" },
    ],
  },
  {
    title: "Sales",
    links: [
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/coupons", label: "Coupons" },
    ],
  },
  {
    title: "Customers",
    links: [
      { href: "/admin/customers", label: "Customers" },
      { href: "/admin/reviews", label: "Reviews" },
      { href: "/admin/tickets", label: "Support tickets" },
    ],
  },
];

export default function AdminNav({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function logout() {
    await apiRequest("/api/auth/logout");
    router.push("/");
    router.refresh();
  }

  const sections = isSuperAdmin
    ? [
        ...SECTIONS,
        {
          title: "System",
          links: [{ href: "/admin/audit", label: "Audit log" }],
        },
      ]
    : SECTIONS;

  const nav = (
    <nav aria-label="Admin navigation" className="space-y-5">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {section.title}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {section.links.map((link) => {
              const active =
                "exact" in link && link.exact
                  ? pathname === link.href
                  : pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm font-medium transition",
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
          </ul>
        </div>
      ))}

      <div className="border-t border-cotton-300 pt-4">
        <button
          type="button"
          onClick={logout}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-madder-600 transition hover:bg-madder-50"
        >
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="hf-btn hf-btn-outline fixed bottom-4 right-4 z-40 shadow-lg lg:hidden"
        aria-label="Open admin menu"
      >
        ☰ Menu
      </button>

      <aside className="hidden w-52 shrink-0 lg:block">
        <div className="sticky top-20">{nav}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-indigo-ink-950/50"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-cotton-50 p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display font-bold text-indigo-ink-950">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="hf-btn hf-btn-ghost px-2"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
