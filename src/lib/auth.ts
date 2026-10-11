import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { env, isProd } from "./env";

export const SESSION_COOKIE = "hf_session";
export const CART_COOKIE = "hf_cart";
const SESSION_DAYS = 7;
const BCRYPT_ROUNDS = 12;

const secretKey = new TextEncoder().encode(env.AUTH_SECRET);

export type Role = "CUSTOMER" | "WHOLESALE" | "ADMIN" | "SUPERADMIN";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  isApproved: boolean;
  sessionId: string;
};

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

/**
 * Burns roughly the same CPU as a real bcrypt comparison. Called when the email
 * does not exist so that "unknown user" and "wrong password" take the same
 * wall-clock time — otherwise response timing leaks which emails are registered.
 */
export async function fakePasswordCheck(): Promise<void> {
  await bcrypt.compare(
    "dummy-password-for-timing-equalisation",
    "$2b$12$3hTvUh93yaR9Hnp21uiOuOVmGL9PqAwYCfZOsfupregNUsvJsKQCC",
  );
}

// ---------------------------------------------------------------------------
// Hashing helpers
// ---------------------------------------------------------------------------

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** IPs are PII. We store only a salted hash for abuse tracking. */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${env.IP_HASH_SALT}:${ip}`).digest("hex");
}

/** Constant-time string comparison that never throws on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still perform a comparison so the failure path costs the same.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * Creates a DB-backed session and returns the signed JWT.
 *
 * The JWT carries only ids — never the role. Roles are re-read from the
 * database on every request, so demoting or banning an admin takes effect
 * immediately instead of waiting for their token to expire.
 */
export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const session = await db.session.create({
    data: {
      userId,
      tokenHash: sha256(raw),
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ipHash: hashIp(meta.ip),
      expiresAt,
    },
  });

  return await new SignJWT({ sid: session.id, jti: raw })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer("hastkala-fab")
    .setAudience("hastkala-fab-web")
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey);
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Resolves the current user, or null. Wrapped in React `cache` so that a page
 * rendering ten components that each need the user still issues one query.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let payload;
  try {
    const verified = await jwtVerify(token, secretKey, {
      issuer: "hastkala-fab",
      audience: "hastkala-fab-web",
      algorithms: ["HS256"],
    });
    payload = verified.payload;
  } catch {
    // Expired, tampered, or signed with a rotated secret.
    return null;
  }

  const sid = typeof payload.sid === "string" ? payload.sid : null;
  const jti = typeof payload.jti === "string" ? payload.jti : null;
  if (!sid || !jti) return null;

  const session = await db.session.findUnique({
    where: { id: sid },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          isApproved: true,
        },
      },
    },
  });

  if (!session || session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  // A valid signature is not enough: the token body must match the stored
  // session, so a leaked JWT for a revoked session is useless.
  if (!safeEqual(session.tokenHash, sha256(jti))) return null;
  if (session.userId !== payload.sub) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role as Role,
    avatarUrl: session.user.avatarUrl,
    isApproved: session.user.isApproved,
    sessionId: session.id,
  };
});

export async function revokeSession(sessionId: string): Promise<void> {
  await db.session
    .update({ where: { id: sessionId }, data: { revokedAt: new Date() } })
    .catch(() => undefined);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Authorisation
// ---------------------------------------------------------------------------

export const ADMIN_ROLES: Role[] = ["ADMIN", "SUPERADMIN"];

export function isAdminRole(role: string | undefined | null): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}

/**
 * Throws instead of returning null. Route handlers catch this and return 401;
 * server components let it bubble to a redirect. Making the "no user" path
 * throw means a forgotten null-check fails closed rather than open.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Authentication required", 401);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdminRole(user.role)) throw new AuthError("Admin access required", 403);
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "SUPERADMIN") {
    throw new AuthError("Super admin access required", 403);
  }
  return user;
}

/** True only for wholesale accounts the admin has actually approved. */
export function canSeeWholesalePricing(user: SessionUser | null): boolean {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  return user.role === "WHOLESALE" && user.isApproved;
}
