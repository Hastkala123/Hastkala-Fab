import "server-only";

import type { Prisma } from "@prisma/client";

/**
 * Returns the next value of a named counter. Must be called inside the same
 * transaction that creates the document: the row lock taken by the UPDATE is
 * held until commit, so concurrent orders get distinct numbers, and a rolled
 * back transaction gives its number back — no gaps (fixes H4).
 */
export async function nextSequence(tx: Prisma.TransactionClient, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "DocumentSequence" ("key", "nextValue", "updatedAt")
    VALUES (${key}, 2, now())
    ON CONFLICT ("key") DO UPDATE
      SET "nextValue" = "DocumentSequence"."nextValue" + 1, "updatedAt" = now()
    RETURNING "nextValue" - 1 AS value`;
  return Number(rows[0]!.value);
}
