import "server-only";

import { cache } from "react";
import { db } from "@/lib/db";
import { getCurrentUser, isApprovedWholesale, type SessionUser } from "@/lib/auth";
import { RETAIL_VIEWER, type Viewer } from "./pricing";

export async function viewerFor(user: SessionUser | null): Promise<Viewer> {
  if (!user || !isApprovedWholesale(user)) return RETAIL_VIEWER;
  const [profile, defaultTier] = await Promise.all([
    db.wholesaleProfile.findUnique({ where: { userId: user.id }, select: { priceTierId: true } }),
    db.priceTier.findFirst({ where: { isDefault: true }, select: { id: true } }),
  ]);
  const defaultTierId = defaultTier?.id ?? null;
  return { wholesale: true, priceTierId: profile?.priceTierId ?? defaultTierId, defaultTierId };
}

/** Pricing context for the signed-in visitor, once per request. */
export const getViewer = cache(async (): Promise<Viewer> => viewerFor(await getCurrentUser()));
