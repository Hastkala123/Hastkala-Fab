import "server-only";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export async function wishlistIdsFor(user: SessionUser | null): Promise<Set<string>> {
  if (!user) return new Set();
  const rows = await db.wishlistItem.findMany({ where: { userId: user.id }, select: { productId: true } });
  return new Set(rows.map((r) => r.productId));
}
