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

export const productPath = (slug: string) => `/products/${slug}`;
export const categoryPath = (slug: string, parentSlug?: string | null) =>
  parentSlug ? `/${parentSlug}/${slug}` : `/${slug}`;
export const orderThankYouPath = (orderNumber: string) => `/order/${orderNumber}/thank-you`;
