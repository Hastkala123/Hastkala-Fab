import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge proxy (Next.js 16's successor to middleware.ts).
 *
 * SCOPE — read this before adding anything here:
 * This layer performs NO authorisation. It seeds the CSRF cookie and adds
 * request-scoped headers, nothing more. Next.js middleware has historically
 * been bypassable via crafted internal headers (CVE-2025-29927), so every
 * access decision in this app is made in the server component or route handler
 * that actually touches the data — see requireUser/requireAdmin in lib/auth.
 * Treat anything decided here as a convenience, never as a security boundary.
 */

const CSRF_COOKIE = "hf_csrf";

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

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

  // Lets server components read the current path (useful for login redirects).
  response.headers.set("x-pathname", request.nextUrl.pathname);

  return response;
}

export const config = {
  /**
   * Skip static assets and uploaded images — they need no cookie and running
   * the proxy on them would just add latency to every image request.
   */
  matcher: ["/((?!_next/static|_next/image|uploads|favicon.ico|robots.txt|sitemap.xml).*)"],
};
