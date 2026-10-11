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
 * Database-backed fixed-window limiter.
 *
 * A DB table rather than an in-memory Map because the app may run several
 * instances behind a load balancer — an in-memory counter would let an attacker
 * multiply their budget by the number of instances. Swap for Redis if you
 * outgrow SQLite's write throughput.
 */
export async function rateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const key = sha256(`${env.IP_HASH_SALT}:${bucket}:${identifier}`);
  const now = new Date();

  const existing = await db.rateLimitEntry.findUnique({ where: { key } });

  if (!existing || existing.expiresAt <= now) {
    const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
    await db.rateLimitEntry.upsert({
      where: { key },
      create: { key, count: 1, expiresAt },
      update: { count: 1, expiresAt },
    });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.expiresAt.getTime() - now.getTime()) / 1000),
      ),
    };
  }

  const updated = await db.rateLimitEntry.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  return {
    allowed: true,
    remaining: Math.max(0, limit - updated.count),
    retryAfterSeconds: 0,
  };
}

/**
 * Best-effort client IP. Proxy headers are attacker-controlled, so this is only
 * ever used for rate limiting and hashed audit trails — never for authorisation.
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

/** Housekeeping: drop expired windows so the table cannot grow unbounded. */
export async function pruneRateLimits(): Promise<void> {
  await db.rateLimitEntry
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined);
}

export const RATE_LIMITS = {
  login: { limit: 5, window: 15 * 60 },
  signup: { limit: 3, window: 60 * 60 },
  passwordChange: { limit: 5, window: 60 * 60 },
  checkout: { limit: 10, window: 60 * 60 },
  review: { limit: 5, window: 60 * 60 },
  ticket: { limit: 5, window: 60 * 60 },
  upload: { limit: 60, window: 60 * 60 },
  newsletter: { limit: 3, window: 60 * 60 },
  writeApi: { limit: 60, window: 60 },
} as const;
