import "server-only";

import { headers } from "next/headers";
import { db } from "./db";
import { sha256 } from "./auth";
import { env } from "./env";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Fixed-window limiter backed by one atomic PostgreSQL statement.
 *
 * The old read-then-write version let parallel requests slip past the limit
 * (H9). Here the increment and the window reset happen in a single
 * INSERT … ON CONFLICT … RETURNING, so N concurrent requests always see N
 * distinct counts. It works across any number of app instances.
 */
export async function rateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const key = sha256(`${env.IP_HASH_SALT}:${bucket}:${identifier}`);
  const windowEnd = new Date(Date.now() + windowSeconds * 1000);

  const rows = await db.$queryRaw<{ count: number; expiresAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt")
    VALUES (${key}, 1, ${windowEnd})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= now() THEN 1
                     ELSE "RateLimitBucket"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= now() THEN EXCLUDED."expiresAt"
                         ELSE "RateLimitBucket"."expiresAt" END
    RETURNING "count", "expiresAt"`;

  const { count, expiresAt } = rows[0]!;
  if (count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000)),
    };
  }
  return { allowed: true, remaining: Math.max(0, limit - count), retryAfterSeconds: 0 };
}

/**
 * Best-effort client IP. Proxy headers can be forged, so this is used only for
 * rate limiting and hashed audit trails — never for authorisation. On Vercel
 * the platform overwrites x-forwarded-for, so the first entry is the client.
 */
export async function getClientIp(): Promise<string> {
  const hdrs = await headers();
  const forwarded = hdrs.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return hdrs.get("x-real-ip") ?? "0.0.0.0";
}

export async function getUserAgent(): Promise<string | null> {
  const hdrs = await headers();
  return hdrs.get("user-agent");
}

/** Housekeeping job: drop expired windows so the table cannot grow unbounded. */
export async function pruneRateLimits(): Promise<number> {
  const result = await db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}

/**
 * Budgets per bucket. Login is limited per account AND per IP separately (see
 * api/auth/login): a per-IP-only limit locks out whole mobile networks that
 * share one address (CGNAT), which is common in India.
 */
export const RATE_LIMITS = {
  loginPerIp: { limit: 30, window: 15 * 60 },
  loginPerAccount: { limit: 8, window: 15 * 60 },
  signup: { limit: 5, window: 60 * 60 },
  passwordChange: { limit: 5, window: 60 * 60 },
  checkout: { limit: 20, window: 60 * 60 },
  coupon: { limit: 20, window: 10 * 60 },
  review: { limit: 5, window: 60 * 60 },
  ticket: { limit: 5, window: 60 * 60 },
  upload: { limit: 120, window: 60 * 60 },
  newsletter: { limit: 5, window: 60 * 60 },
  pincode: { limit: 30, window: 60 },
  track: { limit: 10, window: 10 * 60 },
  writeApi: { limit: 60, window: 60 },
  adminWrite: { limit: 240, window: 60 },
} as const;
