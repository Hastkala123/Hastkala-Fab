import "server-only";

import { Prisma, type InquiryStatus, type WholesalePaymentTerms, type WholesaleStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { NotFoundError, UserError } from "@/server/errors";
import { assertSimpleTransition, WHOLESALE_TRANSITIONS } from "@/server/orders/transitions";

/**
 * Staff side of wholesale: reviewing applications (with the tier and payment
 * terms granted), price tiers, and leads from the /wholesale page.
 */

export type TermsInput = {
  priceTierId: string;
  paymentTerms: WholesalePaymentTerms;
  advancePercent: number | null;
  creditLimit: number | null;
  creditDays: number | null;
  staffNotes: string | null;
};

export type ReviewAction =
  | ({ action: "approve" } & TermsInput)
  | ({ action: "update-terms" } & TermsInput)
  | { action: "reject"; reason: string }
  | { action: "suspend"; reason: string | null }
  | { action: "reinstate" };

const NEXT_STATUS: Record<ReviewAction["action"], WholesaleStatus | null> = {
  approve: "APPROVED",
  "update-terms": null,
  reject: "REJECTED",
  suspend: "SUSPENDED",
  reinstate: "APPROVED",
};

function termsData(input: TermsInput) {
  return {
    priceTierId: input.priceTierId,
    paymentTerms: input.paymentTerms,
    // Only the numbers that apply to the chosen terms are kept.
    advancePercent: input.paymentTerms === "ADVANCE_BALANCE" ? input.advancePercent : null,
    creditLimit: input.paymentTerms === "CREDIT" ? input.creditLimit : null,
    creditDays: input.paymentTerms === "CREDIT" ? input.creditDays : null,
    staffNotes: input.staffNotes,
  };
}

/**
 * One place for every wholesale status change. Approval switches the account
 * to trade prices at once (the session reads the status on every request);
 * rejection and suspension switch it back to retail.
 */
export async function reviewApplication(staff: SessionUser, profileId: string, input: ReviewAction): Promise<void> {
  const profile = await db.wholesaleProfile.findUnique({
    where: { id: profileId },
    select: { id: true, userId: true, status: true, priceTierId: true, paymentTerms: true },
  });
  if (!profile) throw new NotFoundError("Wholesale application not found");

  const next = NEXT_STATUS[input.action];
  if (next && next !== profile.status) assertSimpleTransition(WHOLESALE_TRANSITIONS, profile.status, next, "wholesale account");
  if (input.action === "update-terms" && profile.status !== "APPROVED" && profile.status !== "SUSPENDED") {
    throw new UserError("Approve the account first.", 409);
  }
  if ("priceTierId" in input && !(await db.priceTier.findUnique({ where: { id: input.priceTierId }, select: { id: true } }))) {
    throw new UserError("Please correct the highlighted fields", 422, { priceTierId: "Choose a price tier." });
  }
  const now = new Date();
  const data: Prisma.WholesaleProfileUpdateInput = {};
  if ("priceTierId" in input) {
    // Empty advance % / credit days fall back to the store defaults in Settings → Wholesale.
    const { priceTierId, ...terms } = termsData(input);
    Object.assign(data, terms, { priceTier: { connect: { id: priceTierId } } });
  }
  if (next && next !== profile.status) {
    Object.assign(data, { status: next, reviewedAt: now, reviewedById: staff.id });
  }
  if (input.action === "approve") Object.assign(data, { rejectionReason: null, gstinVerifiedAt: now });
  if (input.action === "reinstate") data.rejectionReason = null;
  if (input.action === "reject") data.rejectionReason = input.reason;
  if (input.action === "suspend") data.rejectionReason = input.reason ?? "Your wholesale account is on hold. Please contact us.";

  const resultingStatus = next ?? profile.status;
  await db.$transaction([
    db.wholesaleProfile.update({ where: { id: profile.id }, data }),
    db.user.update({
      where: { id: profile.userId },
      data: { customerType: resultingStatus === "APPROVED" ? "WHOLESALE" : "RETAIL" },
    }),
  ]);

  await audit({
    actor: staff,
    action: `wholesale.${input.action}`,
    entityType: "WholesaleProfile",
    entityId: profile.id,
    before: { status: profile.status, priceTierId: profile.priceTierId, paymentTerms: profile.paymentTerms },
    after: input,
  });
}

// ---------------------------------------------------------------------------
// Price tiers
// ---------------------------------------------------------------------------

export async function saveTier(
  staff: SessionUser,
  input: { name: string; description: string | null; isDefault: boolean },
  tierId?: string,
) {
  try {
    const tier = await db.$transaction(async (tx) => {
      if (tierId) {
        const existing = await tx.priceTier.findUnique({ where: { id: tierId } });
        if (!existing) throw new NotFoundError("Price tier not found");
        if (existing.isDefault && !input.isDefault) {
          throw new UserError("Make another tier the default instead — there must always be one.", 409);
        }
      }
      if (input.isDefault) await tx.priceTier.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      const anyDefault = await tx.priceTier.count({ where: { isDefault: true } });
      const data = { name: input.name, description: input.description, isDefault: input.isDefault || anyDefault === 0 };
      return tierId ? tx.priceTier.update({ where: { id: tierId }, data }) : tx.priceTier.create({ data });
    });
    await audit({ actor: staff, action: tierId ? "tier.update" : "tier.create", entityType: "PriceTier", entityId: tier.id, after: input });
    return tier;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new UserError("Please correct the highlighted fields", 422, { name: "A tier with this name already exists." });
    }
    throw error;
  }
}

/** A tier can go once no buyer is on it; its prices go with it. */
export async function deleteTier(staff: SessionUser, tierId: string): Promise<void> {
  const tier = await db.priceTier.findUnique({
    where: { id: tierId },
    select: { id: true, name: true, isDefault: true, _count: { select: { profiles: true } } },
  });
  if (!tier) throw new NotFoundError("Price tier not found");
  if (tier.isDefault) throw new UserError("The default tier can't be deleted. Make another tier the default first.", 409);
  if (tier._count.profiles > 0) {
    throw new UserError(`${tier._count.profiles} buyer${tier._count.profiles === 1 ? " is" : "s are"} on this tier. Move them to another tier first.`, 409);
  }
  await db.priceTier.delete({ where: { id: tierId } });
  await audit({ actor: staff, action: "tier.delete", entityType: "PriceTier", entityId: tierId, before: { name: tier.name } });
}

// ---------------------------------------------------------------------------
// Inquiries (leads)
// ---------------------------------------------------------------------------

export async function updateInquiry(
  staff: SessionUser,
  input: { id: string; status?: InquiryStatus; staffNotes: string | null },
): Promise<void> {
  const inquiry = await db.wholesaleInquiry.findUnique({ where: { id: input.id }, select: { status: true } });
  if (!inquiry) throw new NotFoundError("Enquiry not found");
  await db.wholesaleInquiry.update({
    where: { id: input.id },
    data: { ...(input.status ? { status: input.status } : {}), staffNotes: input.staffNotes },
  });
  await audit({
    actor: staff,
    action: "inquiry.update",
    entityType: "WholesaleInquiry",
    entityId: input.id,
    before: { status: inquiry.status },
    after: { status: input.status },
  });
}
