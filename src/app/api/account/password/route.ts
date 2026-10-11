import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import {
  createSession,
  hashPassword,
  revokeAllSessions,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { getClientIp, getUserAgent, RATE_LIMITS } from "@/lib/ratelimit";
import { changePasswordSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export const POST = handler(async (request) => {
  const gate = await guard({
    auth: "user",
    csrf: true,
    limit: { bucket: "password", ...RATE_LIMITS.passwordChange },
  });
  if (!gate.ok) return gate.response;

  const sessionUser = gate.ctx.user!;

  const parsed = await parseJson(request, changePasswordSchema);
  if (!parsed.ok) return parsed.response;

  const record = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!record) return fail("Account not found.", 404);

  const valid = await verifyPassword(parsed.data.currentPassword, record.passwordHash);
  if (!valid) {
    return fail("Please correct the highlighted fields", 422, {
      currentPassword: "That is not your current password.",
    });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.user.update({ where: { id: record.id }, data: { passwordHash } });

  // Changing a password must invalidate every existing session — that is the
  // action a user takes when they believe their account is compromised, and it
  // is worthless if the attacker's session survives it.
  await revokeAllSessions(record.id);

  // Then re-issue one for the current browser, so the user is not logged out
  // of the device they are actively using.
  const [ip, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);
  const token = await createSession(record.id, { ip, userAgent });
  await setSessionCookie(token);

  await audit({
    userId: record.id,
    actorEmail: record.email,
    action: "user.password.change",
    entity: "User",
    entityId: record.id,
  });

  return ok({ success: true, message: "Password updated. All other devices signed out." });
});
