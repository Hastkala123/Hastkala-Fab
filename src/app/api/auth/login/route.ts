import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { createSession, fakePasswordCheck, setSessionCookie, verifyPassword } from "@/lib/auth";
import { getClientIp, getUserAgent, rateLimit, RATE_LIMITS } from "@/lib/ratelimit";
import { loginSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { mergeGuestCart } from "@/server/cart";

export const runtime = "nodejs";

/** After this many consecutive failures the account is frozen briefly. */
const MAX_FAILED_LOGINS = 8;
const LOCKOUT_MINUTES = 15;

export const POST = handler(async (request) => {
  const gate = await guard({ limit: { bucket: "login-ip", ...RATE_LIMITS.loginPerIp } });
  if (!gate.ok) return gate.response;

  const parsed = await parseJson(request, loginSchema);
  if (!parsed.ok) return parsed.response;
  const { email, password } = parsed.data;

  // Per-account limit too, so a botnet with many IPs can't hammer one account.
  const perAccount = await rateLimit(
    "login-account",
    email,
    RATE_LIMITS.loginPerAccount.limit,
    RATE_LIMITS.loginPerAccount.window,
  );
  if (!perAccount.allowed) {
    return fail(`Too many attempts. Try again in ${Math.ceil(perAccount.retryAfterSeconds / 60)} minutes.`, 429);
  }

  const user = await db.user.findUnique({ where: { email } });

  // Same message and comparable timing for every failure, so the endpoint
  // can't be used to find out which emails have accounts.
  const genericFailure = fail("Incorrect email or password.", 401);

  if (!user || !user.passwordHash || user.status === "DELETED") {
    await fakePasswordCheck();
    return genericFailure;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return fail(`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, 423);
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const updated = await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (updated.failedLoginCount >= MAX_FAILED_LOGINS) {
      await db.user.update({
        where: { id: user.id },
        data: { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000), failedLoginCount: 0 },
      });
      await audit({ actor: user, action: "auth.lockout", entityType: "User", entityId: user.id });
    }
    return genericFailure;
  }

  if (user.status === "BLOCKED") {
    return fail("This account has been disabled. Please contact us if you think this is a mistake.", 403);
  }

  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }

  const [ip, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);
  const token = await createSession(user.id, { ip, userAgent });
  await setSessionCookie(token);
  await mergeGuestCart(user.id);

  if (user.isStaff) {
    await audit({ actor: user, action: "auth.login", entityType: "User", entityId: user.id });
  }

  return ok({ user: { name: user.name, isStaff: user.isStaff } });
});
