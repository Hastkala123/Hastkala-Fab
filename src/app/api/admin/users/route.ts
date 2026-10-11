import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { isAdminRole, revokeAllSessions } from "@/lib/auth";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { userRoleSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * PATCH — change a user's role or wholesale approval.
 *
 * Privilege rules, all enforced server-side:
 *   - Only a SUPERADMIN may grant or revoke the ADMIN role.
 *   - Nobody may change their own role (no self-promotion, no self-demotion
 *     that would lock the last admin out).
 *   - The SUPERADMIN role is not grantable through this endpoint at all; it is
 *     assigned deliberately via the seed or a direct database change.
 */
export const PATCH = handler(async (request) => {
  const gate = await guard({
    auth: "admin",
    csrf: true,
    limit: { bucket: "admin-user", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const admin = gate.ctx.user!;

  const parsed = await parseJson(request, userRoleSchema);
  if (!parsed.ok) return parsed.response;

  const { userId, role, isApproved } = parsed.data;

  if (userId === admin.id) {
    return fail("You cannot change your own role.", 403);
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, name: true },
  });
  if (!target) return fail("User not found.", 404);

  if (target.role === "SUPERADMIN") {
    return fail("A super admin account cannot be modified from here.", 403);
  }

  const grantingAdmin = role === "ADMIN";
  const revokingAdmin = target.role === "ADMIN" && role !== "ADMIN";

  if ((grantingAdmin || revokingAdmin) && admin.role !== "SUPERADMIN") {
    return fail("Only a super admin can grant or revoke admin access.", 403);
  }

  await db.user.update({
    where: { id: target.id },
    data: {
      role,
      // Admins are implicitly approved; wholesale approval is explicit.
      isApproved: isAdminRole(role) ? true : isApproved,
    },
  });

  // A role change must not wait for the old token to expire. Revoking forces
  // the user to re-authenticate with their new (or reduced) privileges.
  if (target.role !== role) {
    await revokeAllSessions(target.id);
  }

  await audit({
    userId: admin.id,
    actorEmail: admin.email,
    action: "user.role.update",
    entity: "User",
    entityId: target.id,
    metadata: {
      targetEmail: target.email,
      from: target.role,
      to: role,
      isApproved,
    },
  });

  return ok({ success: true });
});
