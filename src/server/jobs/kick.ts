import "server-only";

import { after } from "next/server";

/**
 * Runs due jobs right after the current response is sent, so a refund
 * reaches the gateway in seconds instead of at the next scheduler tick.
 * Outside a request (tests, scripts) it does nothing; the scheduler picks
 * the work up.
 */
export function kickJobs(): void {
  try {
    after(async () => {
      const { runDueJobs } = await import("./runner");
      await runDueJobs({ limit: 5, budgetMs: 20_000 }).catch((error) =>
        console.error("[jobs] run after response failed:", error),
      );
    });
  } catch {
    // Not inside a request.
  }
}
