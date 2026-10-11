import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { hashPassword, revokeAllSessions, verifyPassword } from "@/lib/auth";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { changePasswordSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export const POST = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "password", ...RATE_LIMITS.passwordChange } });
  if (!gate.ok) return gate.response;
  const user = gate.ctx.user!;

  const parsed = await parseJson(request, changePasswordSchema);
  if (!parsed.ok) return parsed.response;

  const record = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!record?.passwordHash || !(await verifyPassword(parsed.data.currentPassword, record.passwordHash))) {
    return fail("Please correct the highlighted fields", 422, { currentPassword: "That is not your current password." });
  }

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } });

  // Someone changing their password often suspects a break-in, so other
  // devices are signed out (this browser stays signed in).
  if (parsed.data.signOutOthers) await revokeAllSessions(user.id, user.sessionId);

  await audit({ actor: user, action: "user.password.change", entityType: "User", entityId: user.id });
  return ok({
    success: true,
    message: parsed.data.signOutOthers ? "Password updated. Other devices have been signed out." : "Password updated.",
  });
});
