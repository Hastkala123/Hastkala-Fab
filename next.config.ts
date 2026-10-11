import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 * CSP is intentionally strict: no inline scripts except Next's hydration
 * bootstrap (which requires 'unsafe-inline' fallback for older browsers that
 * ignore strict-dynamic). Images are restricted to self + data: for blur
 * placeholders.
 */
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js injects inline bootstrap scripts; style-src needs inline for
      // Tailwind's runtime-injected critical CSS.
      "script-src 'self' 'unsafe-inline'" +
        (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Never leak stack traces / source maps of server code to the browser.
  productionBrowserSourceMaps: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Only our own media is optimised; no remote patterns = no SSRF via next/image.
    remotePatterns: [],
    localPatterns: [{ pathname: "/media/**", search: "" }],
  },
  /**
   * Old URLs (before the October 2026 rebuild) move permanently to the new
   * ones, so links and search rankings carry over. /category/* is redirected
   * in its page, because a sub-category's new URL includes its parent.
   */
  async redirects() {
    return [
      { source: "/product/:slug", destination: "/products/:slug", statusCode: 301 },
      { source: "/products", destination: "/search", statusCode: 301 },
      { source: "/order-confirmed/:orderNumber", destination: "/order/:orderNumber/thank-you", statusCode: 301 },
      { source: "/track-order", destination: "/track", statusCode: 301 },
      { source: "/help", destination: "/account/support", statusCode: 302 },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
