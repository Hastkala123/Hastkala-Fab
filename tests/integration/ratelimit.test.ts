import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { resetDatabase } from "./fixtures";

/**
 * The test database runs in IST on purpose: raw SQL that used plain now()
 * against UTC columns would reset every window and never limit anything.
 */

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("rateLimit", () => {
  it("allows the limit, then blocks until the window ends", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit("test", "shopper-1", 3, 60));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3]!.retryAfterSeconds).toBeGreaterThan(0);
    expect(results[3]!.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("counts parallel requests exactly", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => rateLimit("test", "shopper-2", 5, 60)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("starts a new window once the old one has ended", async () => {
    await rateLimit("test", "shopper-3", 1, 60);
    expect((await rateLimit("test", "shopper-3", 1, 60)).allowed).toBe(false);
    await db.rateLimitBucket.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await rateLimit("test", "shopper-3", 1, 60)).allowed).toBe(true);
  });
});
