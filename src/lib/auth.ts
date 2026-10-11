import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { CustomerType, WholesaleStatus } from "@prisma/client";
import { db } from "./db";
import { env, isProd } from "./env";
import { hasPermission, type Permission } from "@/server/auth/permissions";

export const SESSION_COOKIE = "hf_session";
export const CART_COOKIE = "hf_cart";
const SESSION_DAYS = 7;
const BCRYPT_ROUNDS = 12;
/** lastSeenAt is refreshed at most this often, to keep reads cheap. */
const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000;

const secretKey = new TextEncoder().encode(env.AUTH_SECRET);

export type SessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  isStaff: boolean;
  isOwner: boolean;
  permissions: string[];
  /** WHOLESALE only once the wholesale application is approved. */
  customerType: CustomerType;
  wholesaleStatus: WholesaleStatus | null;
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
 * Burns roughly the same CPU as a real bcrypt comparison. Called when the
 * account does not exist so "unknown user" and "wrong password" take the same
 * time — otherwise response timing reveals which emails are registered.
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

/** IPs are personal data. Only a salted hash is stored, for abuse tracking. */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${env.IP_HASH_SALT}:${ip}`).digest("hex");
}

/** Constant-time string comparison that never throws on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * Creates a DB-backed session and returns the signed JWT. The JWT carries only
 * ids; roles and permissions are re-read from the database on every request,
 * so demoting or blocking someone takes effect immediately.
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

  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

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

/** Resolves the current user, or null. One query per request (React cache). */
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
    return null; // expired, tampered, or signed with a rotated secret
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
          phone: true,
          name: true,
          status: true,
          isStaff: true,
          isOwner: true,
          customerType: true,
          staffRole: { select: { permissions: true } },
          wholesaleProfile: { select: { status: true } },
        },
      },
    },
  });

  if (!session || session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  // A valid signature is not enough: the token must match the stored session,
  // so a leaked JWT for a revoked session is useless.
  if (!safeEqual(session.tokenHash, sha256(jti))) return null;
  if (session.userId !== payload.sub) return null;
  if (session.user.status !== "ACTIVE") return null;

  if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_REFRESH_MS) {
    await db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  const { user } = session;
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    isStaff: user.isStaff,
    isOwner: user.isOwner,
    permissions: user.isStaff ? (user.staffRole?.permissions ?? []) : [],
    customerType: user.customerType,
    wholesaleStatus: user.wholesaleProfile?.status ?? null,
    sessionId: session.id,
  };
});

export async function revokeSession(sessionId: string): Promise<void> {
  await db.session
    .update({ where: { id: sessionId }, data: { revokedAt: new Date() } })
    .catch(() => undefined);
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Authorisation
// ---------------------------------------------------------------------------

/**
 * Thrown instead of returning null: a forgotten null-check then fails closed.
 * Route handlers turn it into 401/403; server components into a redirect.
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

/** Any staff member; with a permission, only staff who hold it (or the owner). */
export async function requireStaff(permission?: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isStaff) throw new AuthError("Staff access required", 403);
  if (permission && !hasPermission(user, permission)) {
    throw new AuthError("You do not have permission to do that", 403);
  }
  return user;
}

export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isStaff || !user.isOwner) throw new AuthError("Owner access required", 403);
  return user;
}

/** Wholesale prices are shown only to approved wholesale buyers. */
export function isApprovedWholesale(user: SessionUser | null): boolean {
  return user?.customerType === "WHOLESALE" && user.wholesaleStatus === "APPROVED";
}

export function can(user: SessionUser | null, permission: Permission): boolean {
  return hasPermission(user, permission);
}
