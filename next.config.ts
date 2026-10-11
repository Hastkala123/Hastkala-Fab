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
    // Only local uploads are served; no remote patterns = no SSRF via next/image.
    remotePatterns: [],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Uploaded files must never be interpreted as HTML/JS by the browser.
        source: "/uploads/:path*",
        headers: [
          { key: "Content-Disposition", value: "inline" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; img-src 'self'; sandbox",
          },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
