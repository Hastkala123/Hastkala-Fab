import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge proxy (Next.js 16's successor to middleware.ts).
 *
 * SCOPE — read this before adding anything here:
 * This layer performs NO authorisation. It seeds the CSRF cookie, sets the
 * page's Content-Security-Policy and adds request-scoped headers, nothing
 * more. Next.js middleware has historically been bypassable via crafted
 * internal headers (CVE-2025-29927), so every access decision in this app is
 * made in the server component or route handler that actually touches the
 * data — see requireUser/requireAdmin in lib/auth.
 * Treat anything decided here as a convenience, never as a security boundary.
 */

const CSRF_COOKIE = "hf_csrf";

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomNonce(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Scripts run only if they carry this response's nonce (Next.js adds it to its
 * own scripts) or were loaded by a script that does ('strict-dynamic' — this is
 * how Razorpay Checkout loads). Injected markup can't run script even if
 * something slips past React's escaping. 'unsafe-inline' and the host list are
 * fallbacks that browsers supporting nonces ignore.
 */
function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https://checkout.razorpay.com${dev ? " 'unsafe-eval'" : ""}`,
    // Tailwind and Next.js set inline styles.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.razorpay.com",
    "connect-src 'self' https://*.razorpay.com",
    "frame-src https://api.razorpay.com https://checkout.razorpay.com",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = randomNonce();
  const csp = contentSecurityPolicy(nonce);

  // Next.js reads the nonce from the request's CSP header. The path lets
  // server components send signed-out visitors back here after sign-in; it
  // replaces any x-pathname the client sent.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", csp);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  // Seed a CSRF token for first-time visitors. Layouts and server components
  // cannot set cookies, so this is the only place it can happen up front.
  const existing = request.cookies.get(CSRF_COOKIE)?.value;
  if (!existing || existing.length !== 64) {
    response.cookies.set(CSRF_COOKIE, randomToken(), {
      // Readable by JS by design: the client echoes it in the x-csrf-token
      // header, which is what a cross-origin attacker cannot do.
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
  }

  return response;
}

export const config = {
  /**
   * Skip static assets and uploaded images — they need no cookie and running
   * the proxy on them would just add latency to every image request.
   */
  matcher: ["/((?!_next/static|_next/image|uploads|favicon.ico|robots.txt|sitemap.xml).*)"],
};
