import "server-only";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { safeEqual } from "./auth";
import { env, isProd } from "./env";

export const CSRF_COOKIE = "hf_csrf";
export const CSRF_HEADER = "x-csrf-token";

/**
 * Double-submit cookie pattern: the token lives in a readable cookie AND must
 * be echoed back in a request header. A cross-site attacker can cause the
 * browser to *send* the cookie but cannot *read* it to set the header, because
 * the same-origin policy blocks reading another origin's response.
 *
 * The cookie is normally seeded by src/proxy.ts, since server components are
 * not permitted to write cookies. This function is the route-handler-side
 * equivalent for the rare case where a request arrives without one.
 */
export async function getOrCreateCsrfToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(CSRF_COOKIE)?.value;
  if (existing && existing.length === 64) return existing;

  const token = randomBytes(32).toString("hex");
  store.set(CSRF_COOKIE, token, {
    // Deliberately readable by JS so the client can attach the header.
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return token;
}

/** Read-only accessor safe to call from a server component. */
export async function readCsrfToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CSRF_COOKIE)?.value ?? null;
}

/**
 * Verifies a state-changing request. Combines three independent checks — any
 * one failing rejects the request:
 *   1. Origin/Referer must match our own host (blocks classic cross-site POSTs)
 *   2. CSRF cookie must be present
 *   3. Header token must equal the cookie token (constant-time)
 */
export async function verifyCsrf(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const hdrs = await headers();
  const store = await cookies();

  const origin = hdrs.get("origin");
  const referer = hdrs.get("referer");
  const host = hdrs.get("host");

  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return { ok: false, reason: "Malformed Origin header" };
    }
    if (host && originHost !== host) {
      return { ok: false, reason: "Origin mismatch" };
    }
  } else if (referer) {
    let refererHost: string;
    try {
      refererHost = new URL(referer).host;
    } catch {
      return { ok: false, reason: "Malformed Referer header" };
    }
    if (host && refererHost !== host) {
      return { ok: false, reason: "Referer mismatch" };
    }
  } else if (isProd) {
    // In production a browser always sends Origin on cross-origin POSTs and on
    // same-origin POSTs from fetch(). No Origin and no Referer is not a shape
    // we expect from a real user agent.
    return { ok: false, reason: "Missing Origin and Referer" };
  }

  const cookieToken = store.get(CSRF_COOKIE)?.value;
  const headerToken = hdrs.get(CSRF_HEADER);

  if (!cookieToken) return { ok: false, reason: "Missing CSRF cookie" };
  if (!headerToken) return { ok: false, reason: "Missing CSRF header" };
  if (!safeEqual(cookieToken, headerToken)) {
    return { ok: false, reason: "CSRF token mismatch" };
  }

  return { ok: true };
}

export const siteUrl = env.NEXT_PUBLIC_SITE_URL;
