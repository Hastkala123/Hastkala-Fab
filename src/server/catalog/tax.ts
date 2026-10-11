import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import type { TaxBand } from "@/server/tax/gst";

type Client = PrismaClient | Prisma.TransactionClient;

/**
 * GST bands in force at `at` for each HSN code, from Admin → Tax. A product
 * uses its own HSN code, falling back to its category's.
 */
export async function loadTaxBands(
  client: Client,
  hsnCodeIds: string[],
  at: Date = new Date(),
): Promise<Map<string, TaxBand[]>> {
  const ids = [...new Set(hsnCodeIds)];
  const bands = new Map<string, TaxBand[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return bands;

  const rules = await client.taxRule.findMany({
    where: {
      hsnCodeId: { in: ids },
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: { minUnitValue: "asc" },
  });
  for (const rule of rules) {
    bands.get(rule.hsnCodeId)!.push({
      minUnitValue: rule.minUnitValue,
      maxUnitValue: rule.maxUnitValue,
      rateBps: rule.rateBps,
    });
  }
  return bands;
}

export function effectiveHsnId(product: {
  hsnCodeId: string | null;
  category: { hsnCodeId: string | null };
}): string | null {
  return product.hsnCodeId ?? product.category.hsnCodeId;
}
