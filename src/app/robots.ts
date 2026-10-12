import type { MetadataRoute } from "next";
import { env, isProd } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Crawlers may read the shop, not the private parts. A non-production site asks not to be indexed at all. */
export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const live = isProd && !/localhost|127\.0\.0\.1/.test(base);
  return {
    rules: live
      ? {
          userAgent: "*",
          allow: "/",
          disallow: ["/admin", "/account", "/api/", "/cart", "/checkout", "/order/", "/login", "/signup"],
        }
      : { userAgent: "*", disallow: "/" },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
