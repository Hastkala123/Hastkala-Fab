import "server-only";

import type { Prisma } from "@prisma/client";

/**
 * Returns the next value of a named counter. Must be called inside the same
 * transaction that creates the document: the row lock taken by the UPDATE is
 * held until commit, so concurrent orders get distinct numbers, and a rolled
 * back transaction gives its number back — no gaps (fixes H4).
 *
 * Raw SQL in this app always writes and compares times as
 * timezone('utc', now()): Prisma stores UTC in "timestamp without time zone"
 * columns, and plain now() would follow the database session's time zone
 * (IST on a local install), putting times 5½ hours out.
 */
export async function nextSequence(tx: Prisma.TransactionClient, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "DocumentSequence" ("key", "nextValue", "updatedAt")
    VALUES (${key}, 2, timezone('utc', now()))
    ON CONFLICT ("key") DO UPDATE
      SET "nextValue" = "DocumentSequence"."nextValue" + 1, "updatedAt" = timezone('utc', now())
    RETURNING "nextValue" - 1 AS value`;
  return Number(rows[0]!.value);
}
