/**
 * Picks the visitor's IP from proxy headers. A visitor can send any
 * x-forwarded-for they like, and a reverse proxy *appends* the address it
 * saw, so the first entry is attacker-chosen — trusting it would let a fresh
 * fake IP per request dodge every per-IP limit. x-real-ip, set by Vercel and
 * by nginx, wins; otherwise the last entry (added by our own proxy) is used.
 */
export function clientIpFrom(realIp: string | null, forwardedFor: string | null): string {
  const real = realIp?.trim();
  if (real && real.length <= 64) return real;
  const last = forwardedFor
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1);
  if (last && last.length <= 64) return last;
  return "0.0.0.0";
}
