import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Durable background work (the Job table). Enqueue inside the same
 * transaction as the change that needs it, so the work can't be lost:
 * if the change commits, the job exists; if it rolls back, neither does.
 */

export type JobPayloads = {
  /** Send an initiated refund to the payment gateway. */
  "refund.submit": { refundId: string };
  /** Compare recent payments with the gateway; catch late or missed payments. */
  "payments.reconcile": Record<string, never>;
};

export type JobType = keyof JobPayloads;

export async function enqueueJob<T extends JobType>(
  client: Prisma.TransactionClient | typeof db,
  type: T,
  payload: JobPayloads[T],
  options: { dedupeKey?: string; runAt?: Date; maxAttempts?: number } = {},
): Promise<void> {
  // skipDuplicates = ON CONFLICT DO NOTHING on dedupeKey: scheduling the
  // same periodic job twice is harmless.
  await client.job.createMany({
    data: [
      {
        type,
        payload: payload as Prisma.InputJsonObject,
        dedupeKey: options.dedupeKey ?? null,
        runAt: options.runAt ?? new Date(),
        maxAttempts: options.maxAttempts ?? 8,
      },
    ],
    skipDuplicates: true,
  });
}
