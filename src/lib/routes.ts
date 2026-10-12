/**
 * Top-level paths that belong to pages, not categories. Category pages live
 * at /{slug}, so these slugs are refused in Admin → Categories.
 */
export const RESERVED_SLUGS = new Set([
  "about", "account", "admin", "api", "blog", "bestsellers", "cancellation-refund-policy", "cart",
  "category", "checkout", "collections", "contact", "faq", "feeds", "forgot-password", "grievance",
  "journal", "login", "logout", "media", "new-arrivals", "order", "order-confirmed", "our-craft",
  "pages", "privacy-policy", "product", "products", "reset-password", "returns-policy", "robots.txt",
  "search", "shipping-policy", "signup", "sitemap.xml", "static", "terms", "track", "uploads",
  "wholesale", "_next",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/**
 * A redirect target from the URL (`?next=`), reduced to a path on this site.
 * Anything else falls back, so sign-in can't become an open redirect — a
 * standard phishing trick ("hastkalafab.com/login?next=https://evil.example").
 * Browsers drop tabs and newlines and treat "\" like "/", so "/\t/evil" and
 * "/\evil" both mean "//evil" (another site); those are refused too.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/account"): string {
  if (!next || next.length > 2048) return fallback;
  if (/[\u0000-\u001F\u007F\\]/.test(next)) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  try {
    const base = "https://hastkala.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export const productPath = (slug: string) => `/products/${slug}`;
export const categoryPath = (slug: string, parentSlug?: string | null) =>
  parentSlug ? `/${parentSlug}/${slug}` : `/${slug}`;
export const orderThankYouPath = (orderNumber: string) => `/order/${orderNumber}/thank-you`;
