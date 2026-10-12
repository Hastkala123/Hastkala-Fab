import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { can, revokeAllSessions } from "@/lib/auth";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { customerAdminSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { reviewApplication } from "@/server/wholesale/admin";

async function defaultTierId(): Promise<string> {
  const tier =
    (await db.priceTier.findFirst({ where: { isDefault: true }, select: { id: true } })) ??
    (await db.priceTier.create({ data: { name: "Standard", isDefault: true }, select: { id: true } }));
  return tier.id;
}

export const runtime = "nodejs";

/**
 * Block/unblock a customer and approve/reject wholesale buyers.
 * Staff accounts and roles are managed separately (Admin → Staff, owner only).
 */
export const PATCH = handler(async (request) => {
  const gate = await guard({ auth: "staff", limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite } });
  if (!gate.ok) return gate.response;
  const staff = gate.ctx.user!;

  const parsed = await parseJson(request, customerAdminSchema);
  if (!parsed.ok) return parsed.response;
  const { userId, status, wholesaleStatus, rejectionReason, priceTierId } = parsed.data;

  if (userId === staff.id) return fail("You can't change your own account here.", 403);
  if (status && !can(staff, "customers.manage")) return fail("You do not have permission to do that", 403);
  if ((wholesaleStatus || priceTierId) && !can(staff, "wholesale.manage")) {
    return fail("You do not have permission to do that", 403);
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, isStaff: true, customerType: true, wholesaleProfile: true },
  });
  if (!target) return fail("Customer not found.", 404);
  if (target.isStaff && !staff.isOwner) return fail("Only the owner can change staff accounts.", 403);

  if (status && status !== target.status) {
    await db.user.update({ where: { id: userId }, data: { status } });
    // A blocked account is signed out everywhere at once.
    if (status === "BLOCKED") await revokeAllSessions(userId);
  }

  if (wholesaleStatus || priceTierId) {
    const profile = target.wholesaleProfile;
    if (!profile) return fail("This customer hasn't applied for a wholesale account.", 409);
    const terms = {
      priceTierId: priceTierId ?? profile.priceTierId ?? (await defaultTierId()),
      paymentTerms: profile.paymentTerms,
      advancePercent: profile.advancePercent,
      creditLimit: profile.creditLimit,
      creditDays: profile.creditDays,
      staffNotes: profile.staffNotes,
    };
    const action =
      wholesaleStatus === "REJECTED"
        ? rejectionReason
          ? ({ action: "reject", reason: rejectionReason } as const)
          : null
        : wholesaleStatus === "SUSPENDED"
          ? ({ action: "suspend", reason: rejectionReason ?? null } as const)
          : wholesaleStatus === "APPROVED"
            ? profile.status === "SUSPENDED"
              ? ({ action: "reinstate" } as const)
              : ({ action: "approve", ...terms } as const)
            : ({ action: "update-terms", ...terms } as const);
    if (!action) {
      return fail("Please correct the highlighted fields", 422, { rejectionReason: "Tell the buyer why, so they can fix it." });
    }
    await reviewApplication(staff, profile.id, action);
  }

  await audit({
    actor: staff,
    action: "customer.update",
    entityType: "User",
    entityId: userId,
    before: { status: target.status, wholesaleStatus: target.wholesaleProfile?.status ?? null },
    after: { status, wholesaleStatus, priceTierId },
  });
  return ok({ success: true });
});
