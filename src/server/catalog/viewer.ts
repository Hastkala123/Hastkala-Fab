import "server-only";

import { cache } from "react";
import { db } from "@/lib/db";
import { getCurrentUser, isApprovedWholesale, type SessionUser } from "@/lib/auth";
import { RETAIL_VIEWER, type Viewer } from "./pricing";

export async function viewerFor(user: SessionUser | null): Promise<Viewer> {
  if (!user || !isApprovedWholesale(user)) return RETAIL_VIEWER;
  const profile = await db.wholesaleProfile.findUnique({
    where: { userId: user.id },
    select: { priceTierId: true },
  });
  let priceTierId = profile?.priceTierId ?? null;
  if (!priceTierId) {
    const tier = await db.priceTier.findFirst({ where: { isDefault: true }, select: { id: true } });
    priceTierId = tier?.id ?? null;
  }
  return { wholesale: true, priceTierId };
}

/** Pricing context for the signed-in visitor, once per request. */
export const getViewer = cache(async (): Promise<Viewer> => viewerFor(await getCurrentUser()));
