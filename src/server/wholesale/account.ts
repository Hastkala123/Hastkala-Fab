import "server-only";

import { Prisma, type WholesaleDocKind } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { savePrivateDocument } from "@/lib/upload";
import { NotFoundError, UserError } from "@/server/errors";
import { getSettings } from "@/server/settings";
import { deletePrivateFile } from "@/server/storage";
import type { BuyerTerms } from "./terms";

/**
 * A buyer's own wholesale account: applying (and re-applying), documents,
 * and the payment terms staff granted.
 */

const MAX_DOCUMENTS = 8;

export async function getWholesaleAccount(userId: string) {
  return db.wholesaleProfile.findUnique({
    where: { userId },
    include: {
      priceTier: { select: { name: true } },
      documents: { orderBy: { createdAt: "asc" }, select: { id: true, kind: true, fileName: true, createdAt: true } },
    },
  });
}

/** Payment terms for an approved buyer, with store defaults filled in; null otherwise. */
export async function buyerTerms(
  client: Prisma.TransactionClient | typeof db,
  userId: string,
): Promise<BuyerTerms | null> {
  const [profile, settings] = await Promise.all([
    client.wholesaleProfile.findUnique({
      where: { userId },
      select: { status: true, paymentTerms: true, advancePercent: true, creditLimit: true, creditDays: true },
    }),
    getSettings(),
  ]);
  if (!profile || profile.status !== "APPROVED") return null;
  return {
    terms: profile.paymentTerms,
    advancePercent: profile.advancePercent ?? settings.wholesale.advancePercent,
    creditLimit: profile.creditLimit,
    creditDays: profile.creditDays ?? settings.wholesale.creditDays,
  };
}

export type ApplicationInput = {
  businessName: string;
  legalName: string | null;
  gstin: string | null;
  businessType: string;
  addressLine: string | null;
  city: string;
  state: string;
  pincode: string;
  expectedVolume: string | null;
  socialUrl: string | null;
  /** Only used when the account has no mobile number yet. */
  phone?: string | null;
};

/**
 * Applies, re-applies after a rejection, or updates the details. Changing the
 * GSTIN or business name of an approved account sends it back for review
 * (H10): trade prices pause until staff look again.
 */
export async function submitApplication(
  user: SessionUser,
  input: ApplicationInput,
): Promise<{ status: "PENDING" | "APPROVED"; reReview: boolean }> {
  const settings = await getSettings();
  if (settings.wholesale.requireGstin && !input.gstin) {
    throw new UserError("Please correct the highlighted fields", 422, { gstin: "Enter your GSTIN to apply for wholesale." });
  }
  const account = await db.user.findUnique({ where: { id: user.id }, select: { phone: true } });
  if (!account?.phone) {
    if (!input.phone) {
      throw new UserError("Please correct the highlighted fields", 422, { phone: "We confirm wholesale orders by phone." });
    }
    try {
      await db.user.update({ where: { id: user.id }, data: { phone: input.phone } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new UserError("Please correct the highlighted fields", 422, { phone: "This mobile number is already registered." });
      }
      throw error;
    }
  }

  const details = {
    businessName: input.businessName,
    legalName: input.legalName,
    gstin: input.gstin,
    businessType: input.businessType,
    addressLine: input.addressLine,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    expectedVolume: input.expectedVolume,
    socialUrl: input.socialUrl,
  };

  return db.$transaction(async (tx) => {
    const existing = await tx.wholesaleProfile.findUnique({ where: { userId: user.id } });
    if (!existing) {
      await tx.wholesaleProfile.create({ data: { userId: user.id, ...details, status: "PENDING", submittedAt: new Date() } });
      return { status: "PENDING" as const, reReview: false };
    }
    if (existing.status === "SUSPENDED") {
      throw new UserError("Your wholesale account is on hold. Please contact us to make changes.", 409);
    }
    const identityChanged =
      (existing.gstin ?? null) !== (input.gstin ?? null) ||
      existing.businessName.trim().toLowerCase() !== input.businessName.trim().toLowerCase();
    const backToReview = existing.status === "REJECTED" || (existing.status === "APPROVED" && identityChanged);

    await tx.wholesaleProfile.update({
      where: { id: existing.id },
      data: {
        ...details,
        ...(backToReview
          ? { status: "PENDING", rejectionReason: null, submittedAt: new Date(), gstinVerifiedAt: null }
          : {}),
      },
    });
    if (backToReview && existing.status === "APPROVED") {
      await tx.user.update({ where: { id: user.id }, data: { customerType: "RETAIL" } });
    }
    const status = backToReview || existing.status === "PENDING" ? ("PENDING" as const) : ("APPROVED" as const);
    return { status, reReview: backToReview && existing.status === "APPROVED" };
  });
}

const DOC_KINDS: WholesaleDocKind[] = ["GST_CERTIFICATE", "SHOP_PHOTO", "VISITING_CARD", "OTHER"];

export async function addDocument(user: SessionUser, kind: string, file: File) {
  if (!DOC_KINDS.includes(kind as WholesaleDocKind)) throw new UserError("Choose what this document is.", 422);
  const profile = await db.wholesaleProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, status: true, _count: { select: { documents: true } } },
  });
  if (!profile) throw new UserError("Apply for a wholesale account first.", 409);
  if (profile.status === "SUSPENDED") throw new UserError("Your wholesale account is on hold. Please contact us.", 409);
  if (profile._count.documents >= MAX_DOCUMENTS) {
    throw new UserError(`You can upload up to ${MAX_DOCUMENTS} documents. Remove one first.`, 409);
  }

  const saved = await savePrivateDocument(file, `wholesale/${profile.id.toLowerCase()}`);
  if (!saved.ok) throw new UserError(saved.error, 422);
  return db.wholesaleDocument.create({
    data: {
      profileId: profile.id,
      kind: kind as WholesaleDocKind,
      storageKey: saved.storageKey,
      fileName: saved.fileName,
      mimeType: saved.mime,
      sizeBytes: saved.bytes,
    },
    select: { id: true, kind: true, fileName: true, createdAt: true },
  });
}

/** Documents can be removed while the application is being reviewed or was rejected; after approval they're the record. */
export async function removeDocument(user: SessionUser, documentId: string): Promise<void> {
  const document = await db.wholesaleDocument.findFirst({
    where: { id: documentId, profile: { userId: user.id } },
    select: { id: true, storageKey: true, profile: { select: { status: true } } },
  });
  if (!document) throw new NotFoundError("Document not found");
  if (document.profile.status === "APPROVED" || document.profile.status === "SUSPENDED") {
    throw new UserError("Documents of an approved account can't be removed. Contact us if one is wrong.", 409);
  }
  await db.wholesaleDocument.delete({ where: { id: document.id } });
  await deletePrivateFile(document.storageKey);
}

/**
 * Money owed on orders already confirmed (credit, advance balances, bank
 * transfers not yet received). COD is settled at the door and not counted.
 */
export async function outstandingBalance(client: Prisma.TransactionClient | typeof db, userId: string): Promise<number> {
  const rows = await client.$queryRaw<{ total: bigint | number | null }[]>`
    SELECT COALESCE(SUM(GREATEST("grandTotal" - ("amountPaid" - "amountRefunded"), 0)), 0) AS total
      FROM "Order"
     WHERE "userId" = ${userId}
       AND "status" NOT IN ('CANCELLED', 'PENDING_PAYMENT', 'PAYMENT_FAILED', 'RTO_DELIVERED')
       AND "paymentMethod" <> 'COD'`;
  return Number(rows[0]?.total ?? 0);
}
