import "server-only";

import { runScheduledTasks } from "./tasks";

/**
 * Runs the every-minute tasks inside the web server — used in development
 * and on single-server hosting. Serverless hosting uses the cron route
 * instead. One timer per process, kept across hot reloads.
 */
const state = globalThis as unknown as { __hfScheduler?: ReturnType<typeof setInterval> };

export function startInProcessScheduler(): void {
  if (state.__hfScheduler) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runScheduledTasks();
    } catch (error) {
      console.error("[scheduler] run failed:", error);
    } finally {
      running = false;
    }
  };
  state.__hfScheduler = setInterval(tick, 60_000);
  state.__hfScheduler.unref?.();
  setTimeout(tick, 10_000).unref?.();
  console.log("[scheduler] background tasks run every minute in this server");
}
