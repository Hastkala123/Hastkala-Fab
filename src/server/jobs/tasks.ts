import "server-only";

import { db } from "@/lib/db";
import { expireUnpaidOrders } from "@/server/payments/expiry";
import { syncOpenAttempts } from "@/server/payments/reconcile";
import { enqueueJob } from "./enqueue";
import { runDueJobs } from "./runner";

/**
 * Everything that runs every minute, from the cron route (/api/cron/jobs) or
 * the in-process scheduler. Each step is safe to run twice at once, and one
 * failing step never stops the others.
 */
export async function runScheduledTasks(now = new Date()): Promise<Record<string, unknown>> {
  const report: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      report[name] = await fn();
    } catch (error) {
      report[name] = "failed";
      console.error(`[tasks] ${name} failed:`, error);
    }
  };

  await step("expiredOrders", () => expireUnpaidOrders(now));
  await step("checkedPayments", () => syncOpenAttempts(now));
  // Hourly reconciliation: the dedupe key makes it once per hour however often this runs.
  await step("scheduled", async () => {
    await enqueueJob(db, "payments.reconcile", {}, { dedupeKey: `payments.reconcile:${now.toISOString().slice(0, 13)}` });
    return true;
  });
  await step("jobs", () => runDueJobs());
  await step("cleanedUp", async () => {
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
    const { count } = await db.job.deleteMany({ where: { status: "SUCCEEDED", completedAt: { lt: cutoff } } });
    return count;
  });
  return report;
}
