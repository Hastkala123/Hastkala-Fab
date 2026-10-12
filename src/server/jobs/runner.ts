import "server-only";

import { db } from "@/lib/db";
import { reconcileRecentPayments } from "@/server/payments/reconcile";
import { failRefund, submitRefund } from "@/server/payments/refunds";
import { backoffMs } from "./backoff";
import type { JobPayloads, JobType } from "./enqueue";

/**
 * Runs queued jobs. Each job is claimed with FOR UPDATE SKIP LOCKED, so any
 * number of runners (the cron route, the in-process scheduler, a request's
 * after() hook) can work at once without doing a job twice. A job whose
 * runner died is picked up again after 10 minutes.
 */

const HANDLERS: { [T in JobType]: (payload: JobPayloads[T]) => Promise<unknown> } = {
  "refund.submit": ({ refundId }) => submitRefund(refundId),
  "payments.reconcile": () => reconcileRecentPayments(),
};

/** What to do when a job has used all its attempts. */
const ON_DEAD: { [T in JobType]?: (payload: JobPayloads[T], error: string) => Promise<void> } = {
  "refund.submit": ({ refundId }, error) => failRefund(refundId, `The payment gateway kept failing (${error})`),
};

type ClaimedJob = { id: string; type: string; payload: unknown; attempts: number; maxAttempts: number };

async function claimNextJob(): Promise<ClaimedJob | null> {
  const rows = await db.$queryRaw<ClaimedJob[]>`
    UPDATE "Job"
       SET "status" = 'RUNNING', "lockedAt" = timezone('utc', now()), "attempts" = "attempts" + 1
     WHERE "id" = (
       SELECT "id" FROM "Job"
        WHERE ("status" IN ('PENDING', 'FAILED') AND "runAt" <= timezone('utc', now()))
           OR ("status" = 'RUNNING' AND "lockedAt" < timezone('utc', now()) - interval '10 minutes')
        ORDER BY "runAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED)
    RETURNING "id", "type", "payload", "attempts", "maxAttempts"`;
  return rows[0] ?? null;
}

export async function runDueJobs(
  options: { limit?: number; budgetMs?: number } = {},
): Promise<{ succeeded: number; failed: number }> {
  const { limit = 20, budgetMs = 25_000 } = options;
  const started = Date.now();
  let succeeded = 0;
  let failed = 0;

  while (succeeded + failed < limit && Date.now() - started < budgetMs) {
    const job = await claimNextJob();
    if (!job) break;
    const type = job.type as JobType;
    try {
      const handler = HANDLERS[type] as ((payload: unknown) => Promise<unknown>) | undefined;
      if (!handler) throw new Error(`No handler for job type "${job.type}"`);
      await handler(job.payload);
      await db.job.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED", completedAt: new Date(), lockedAt: null, lastError: null },
      });
      succeeded++;
    } catch (error) {
      failed++;
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
      const dead = job.attempts >= job.maxAttempts;
      console.error(`[jobs] ${job.type} ${job.id} attempt ${job.attempts} failed${dead ? " — giving up" : ""}:`, message);
      await db.job.update({
        where: { id: job.id },
        data: {
          status: dead ? "DEAD" : "FAILED",
          lastError: message,
          lockedAt: null,
          ...(dead ? {} : { runAt: new Date(Date.now() + backoffMs(job.attempts)) }),
        },
      });
      if (dead) {
        const onDead = ON_DEAD[type] as ((payload: unknown, error: string) => Promise<void>) | undefined;
        await onDead?.(job.payload, message).catch((e) => console.error(`[jobs] give-up handler for ${job.type} failed:`, e));
      }
    }
  }
  return { succeeded, failed };
}
