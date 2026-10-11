import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import {
  createSession,
  fakePasswordCheck,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { mergeGuestCart } from "@/lib/cart";
import { getClientIp, getUserAgent, RATE_LIMITS } from "@/lib/ratelimit";
import { loginSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** After this many consecutive failures the account is frozen briefly. */
const MAX_FAILED_LOGINS = 8;
const LOCKOUT_MINUTES = 15;

export const POST = handler(async (request) => {
  const gate = await guard({
    csrf: true,
    limit: { bucket: "login", ...RATE_LIMITS.login },
  });
  if (!gate.ok) return gate.response;

  const parsed = await parseJson(request, loginSchema);
  if (!parsed.ok) return parsed.response;

  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });

  // Identical message and comparable timing for every failure mode, so the
  // endpoint cannot be used to enumerate which emails have accounts.
  const genericFailure = fail("Incorrect email or password.", 401);

  if (!user) {
    await fakePasswordCheck();
    return genericFailure;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return fail(
      `Too many failed attempts. This account is locked for another ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      423,
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    const failedLogins = user.failedLogins + 1;
    const shouldLock = failedLogins >= MAX_FAILED_LOGINS;

    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          : null,
      },
    });

    if (shouldLock) {
      await audit({
        userId: user.id,
        actorEmail: user.email,
        action: "auth.lockout",
        entity: "User",
        entityId: user.id,
        metadata: { failedLogins },
      });
    }

    return genericFailure;
  }

  // Successful login clears the failure counter.
  if (user.failedLogins > 0 || user.lockedUntil) {
    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });
  }

  const [ip, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);
  const token = await createSession(user.id, { ip, userAgent });
  await setSessionCookie(token);

  await mergeGuestCart({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "CUSTOMER",
    avatarUrl: user.avatarUrl,
    isApproved: user.isApproved,
    sessionId: "",
  });

  await audit({
    userId: user.id,
    actorEmail: user.email,
    action: "auth.login",
    entity: "User",
    entityId: user.id,
  });

  return ok({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved,
    },
  });
});
