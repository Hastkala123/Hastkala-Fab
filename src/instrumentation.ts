/**
 * Runs once when the server starts. Starts the in-process scheduler for
 * background work (unpaid-order expiry, payment checks, refunds) in
 * development, or anywhere IN_PROCESS_SCHEDULER=true.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const flag = process.env.IN_PROCESS_SCHEDULER;
  const enabled = flag === "true" || (flag !== "false" && process.env.NODE_ENV === "development");
  if (!enabled) return;
  const { startInProcessScheduler } = await import("./server/jobs/scheduler");
  startInProcessScheduler();
}
