/** Wait before retry n (1-based): 30 s, 1 min, 2 min … capped at 1 hour. */
export function backoffMs(attempt: number): number {
  return Math.min(30_000 * 2 ** Math.max(attempt - 1, 0), 60 * 60_000);
}
