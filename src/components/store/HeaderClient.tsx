"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  slug: string;
  children: { id: string; name: string; slug: string }[];
};

type HeaderUser = {
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
} | null;

export default function HeaderClient({
  user,
  cartCount,
  categories,
}: {
  user: HeaderUser;
  cartCount: number;
  categories: Category[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  const accountRef = useRef<HTMLDivElement>(null);

  // Any navigation should dismiss transient menus. Adjusting state during
  // render (rather than in an effect) avoids a wasted extra render pass.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
    setAccountOpen(false);
  }

  // Close the account dropdown on outside click or Escape.
  useEffect(() => {
    if (!accountOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function onSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/products?q=${encodeURIComponent(trimmed)}` : "/products");
  }

  async function onLogout() {
    await apiRequest("/api/auth/logout");
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <a href="#main" className="hf-skip">
        Skip to main content
      </a>

      {/* Announcement bar — doubles as a conversion nudge. */}
      <div className="bg-indigo-ink-900 text-cotton-100">
        <div className="hf-container flex items-center justify-center gap-2 py-2 text-center text-xs font-medium sm:text-sm">
          <span aria-hidden="true">✦</span>
          <p>
            Free shipping on orders above ₹999 · Direct from the block printers of
            Sanganer, Jaipur
          </p>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-cotton-300 bg-cotton-50/95 backdrop-blur supports-[backdrop-filter]:bg-cotton-50/80">
        <div className="hf-container">
          <div className="flex h-16 items-center gap-3 sm:h-18 sm:gap-5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="hf-btn hf-btn-ghost -ml-2 px-2 lg:hidden"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <MenuIcon />
            </button>

            <Link href="/" className="flex shrink-0 items-center gap-2.5">
              <Logo />
              <span className="flex flex-col leading-none">
                <span className="font-display text-lg font-bold tracking-tight text-indigo-ink-900 sm:text-xl">
                  Hastkala Fab
                </span>
                <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-madder-600 sm:block">
                  Sanganeri Handblock
                </span>
              </span>
            </Link>

            {/* Desktop category nav */}
            <nav aria-label="Categories" className="ml-2 hidden lg:block">
              <ul className="flex items-center gap-1">
                {categories.slice(0, 5).map((category) => (
                  <li key={category.id} className="group relative">
                    <Link
                      href={`/category/${category.slug}`}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-ink-900 transition hover:bg-cotton-200"
                    >
                      {category.name}
                      {category.children.length > 0 && (
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      )}
                    </Link>
                    {category.children.length > 0 && (
                      <div className="invisible absolute left-0 top-full z-50 w-56 pt-1 opacity-0 transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                        <ul className="hf-card overflow-hidden py-1.5 shadow-lg">
                          {category.children.map((child) => (
                            <li key={child.id}>
                              <Link
                                href={`/category/${child.slug}`}
                                className="block px-4 py-2 text-sm text-indigo-ink-800 transition hover:bg-cotton-100"
                              >
                                {child.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
                <li>
                  <Link
                    href="/wholesale"
                    className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold text-madder-600 transition hover:bg-madder-50"
                  >
                    Wholesale
                  </Link>
                </li>
              </ul>
            </nav>

            <form onSubmit={onSearch} role="search" className="ml-auto hidden flex-1 max-w-sm md:block">
              <label htmlFor="site-search" className="sr-only">
                Search products
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-ink-400" />
                <input
                  id="site-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search kurtis, sarees, bedsheets…"
                  className="hf-input pl-9"
                  maxLength={100}
                />
              </div>
            </form>

            <div className="ml-auto flex items-center gap-0.5 md:ml-0">
              <Link
                href="/products"
                className="hf-btn hf-btn-ghost px-2.5 md:hidden"
                aria-label="Search"
              >
                <SearchIcon className="h-5 w-5" />
              </Link>

              <Link
                href="/account/wishlist"
                className="hf-btn hf-btn-ghost hidden px-2.5 sm:inline-flex"
                aria-label="Wishlist"
              >
                <HeartIcon className="h-5 w-5" />
              </Link>

              <div ref={accountRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  className="hf-btn hf-btn-ghost px-2.5"
                  aria-label="Account menu"
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                >
                  <UserIcon className="h-5 w-5" />
                  {user && (
                    <span className="hidden max-w-20 truncate text-sm font-semibold lg:inline">
                      {user.name.split(" ")[0]}
                    </span>
                  )}
                </button>

                {accountOpen && (
                  <div
                    role="menu"
                    className="hf-card absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden py-1.5 shadow-xl"
                  >
                    {user ? (
                      <>
                        <div className="border-b border-cotton-200 px-4 pb-2.5 pt-1.5">
                          <p className="truncate text-sm font-semibold text-indigo-ink-900">
                            {user.name}
                          </p>
                          <p className="truncate text-xs text-slate-500">{user.email}</p>
                          {user.role === "WHOLESALE" && (
                            <span className="hf-badge mt-1.5 text-madder-600">Wholesale</span>
                          )}
                        </div>
                        {user.isAdmin && (
                          <MenuLink href="/admin" highlight>
                            Admin dashboard
                          </MenuLink>
                        )}
                        <MenuLink href="/account">My profile</MenuLink>
                        <MenuLink href="/account/orders">My orders</MenuLink>
                        <MenuLink href="/account/wishlist">Wishlist</MenuLink>
                        <MenuLink href="/account/addresses">Addresses</MenuLink>
                        <MenuLink href="/help">Help centre</MenuLink>
                        <div className="mt-1 border-t border-cotton-200 pt-1">
                          <button
                            type="button"
                            onClick={onLogout}
                            role="menuitem"
                            className="block w-full px-4 py-2 text-left text-sm font-medium text-madder-600 transition hover:bg-madder-50"
                          >
                            Sign out
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="px-4 py-2">
                          <p className="text-sm font-semibold text-indigo-ink-900">Welcome</p>
                          <p className="text-xs text-slate-500">
                            Sign in for orders, wishlist and faster checkout.
                          </p>
                        </div>
                        <div className="flex gap-2 px-4 pb-2 pt-1">
                          <Link href="/login" className="hf-btn hf-btn-primary flex-1 py-2 text-sm">
                            Sign in
                          </Link>
                          <Link href="/signup" className="hf-btn hf-btn-outline flex-1 py-2 text-sm">
                            Sign up
                          </Link>
                        </div>
                        <div className="mt-1 border-t border-cotton-200 pt-1">
                          <MenuLink href="/help">Help centre</MenuLink>
                          <MenuLink href="/track-order">Track order</MenuLink>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <Link
                href="/cart"
                className="hf-btn hf-btn-ghost relative px-2.5"
                aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
              >
                <BagIcon className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-madder-600 px-1 text-[10px] font-bold text-white">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-indigo-ink-950/45 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-cotton-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-cotton-300 px-4 py-4">
              <span className="font-display text-lg font-bold text-indigo-ink-900">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="hf-btn hf-btn-ghost px-2"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <div className="border-b border-cotton-300 p-4">
              <form onSubmit={onSearch} role="search">
                <label htmlFor="mobile-search" className="sr-only">
                  Search products
                </label>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-ink-400" />
                  <input
                    id="mobile-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products…"
                    className="hf-input pl-9"
                    maxLength={100}
                  />
                </div>
              </form>
            </div>

            <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-1">
                <li>
                  <Link href="/products" className="block rounded-lg px-3 py-2.5 font-semibold text-indigo-ink-900 hover:bg-cotton-200">
                    All products
                  </Link>
                </li>
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={`/category/${category.slug}`}
                      className="block rounded-lg px-3 py-2.5 font-semibold text-indigo-ink-900 hover:bg-cotton-200"
                    >
                      {category.name}
                    </Link>
                    {category.children.length > 0 && (
                      <ul className="ml-3 border-l border-cotton-300 pl-3">
                        {category.children.map((child) => (
                          <li key={child.id}>
                            <Link
                              href={`/category/${child.slug}`}
                              className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-cotton-200"
                            >
                              {child.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-4 space-y-1 border-t border-cotton-300 pt-4">
                <MobileLink href="/wholesale" accent>Wholesale enquiry</MobileLink>
                <MobileLink href="/account/orders">My orders</MobileLink>
                <MobileLink href="/account/wishlist">Wishlist</MobileLink>
                <MobileLink href="/track-order">Track order</MobileLink>
                <MobileLink href="/help">Help centre</MobileLink>
                <MobileLink href="/faq">FAQ</MobileLink>
                <MobileLink href="/about">Our story</MobileLink>
              </div>
            </nav>

            {!user && (
              <div className="flex gap-2 border-t border-cotton-300 p-4">
                <Link href="/login" className="hf-btn hf-btn-primary flex-1">Sign in</Link>
                <Link href="/signup" className="hf-btn hf-btn-outline flex-1">Sign up</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function MenuLink({
  href,
  children,
  highlight,
}: {
  href: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className={cn(
        "block px-4 py-2 text-sm font-medium transition hover:bg-cotton-100",
        highlight ? "text-madder-600" : "text-indigo-ink-800",
      )}
    >
      {children}
    </Link>
  );
}

function MobileLink({
  href,
  children,
  accent,
}: {
  href: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-cotton-200",
        accent ? "text-madder-600 font-semibold" : "text-slate-600",
      )}
    >
      {children}
    </Link>
  );
}

// --- Icons: inline SVG so there is no icon-library payload or extra request ---

function Logo() {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-ink-800 text-cotton-50">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path
          d="M12 3.2c1.9 2 3 3.6 3 5.3 0 1.7-1.3 3-3 3s-3-1.3-3-3c0-1.7 1.1-3.3 3-5.3Z"
          fill="currentColor"
        />
        <path
          d="M12 20.8c-1.9-2-3-3.6-3-5.3 0-1.7 1.3-3 3-3s3 1.3 3 3c0 1.7-1.1 3.3-3 5.3Z"
          fill="currentColor"
          opacity=".6"
        />
        <path d="M3.2 12c2-1.9 3.6-3 5.3-3M20.8 12c-2 1.9-3.6 3-5.3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.2-3.7 4-5.5 7.5-5.5s6.3 1.8 7.5 5.5" />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7.5-4.6-7.5-9.5a4.2 4.2 0 0 1 7.5-2.6 4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
    </svg>
  );
}

function BagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M5.5 8h13l-1 12h-11l-1-12Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
