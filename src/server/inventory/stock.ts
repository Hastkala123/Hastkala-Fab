import "server-only";

import type { InventoryReason, Prisma } from "@prisma/client";

/** A line could not be reserved because there are not enough pieces left. */
export class StockError extends Error {
  constructor(
    message: string,
    public readonly variantId: string,
  ) {
    super(message);
    this.name = "StockError";
  }
}

type MovementContext = {
  reason: InventoryReason;
  note?: string | null;
  orderId?: string | null;
  returnRequestId?: string | null;
  actorId?: string | null;
};

async function writeLedger(
  tx: Prisma.TransactionClient,
  variantId: string,
  change: number,
  stockAfter: number,
  ctx: MovementContext,
): Promise<void> {
  await tx.inventoryMovement.create({
    data: {
      variantId,
      change,
      stockAfter,
      reason: ctx.reason,
      note: ctx.note ?? null,
      orderId: ctx.orderId ?? null,
      returnRequestId: ctx.returnRequestId ?? null,
      actorId: ctx.actorId ?? null,
    },
  });
}

/**
 * Takes pieces out of stock — only if enough are left. A single conditional
 * UPDATE … WHERE stock >= qty means two shoppers racing for the last saree
 * cannot both win; the loser gets a StockError and their transaction rolls back.
 */
export async function takeStock(
  tx: Prisma.TransactionClient,
  variantId: string,
  quantity: number,
  ctx: MovementContext & { label: string },
): Promise<number> {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new RangeError("quantity must be positive");
  const rows = await tx.$queryRaw<{ stock: number }[]>`
    UPDATE "ProductVariant"
       SET "stock" = "stock" - ${quantity}, "updatedAt" = now()
     WHERE "id" = ${variantId} AND "stock" >= ${quantity}
       AND "isActive" = true AND "archivedAt" IS NULL
    RETURNING "stock"`;
  if (rows.length === 0) {
    throw new StockError(`Sorry, "${ctx.label}" just sold out or has fewer pieces left than you asked for.`, variantId);
  }
  const stockAfter = rows[0]!.stock;
  await writeLedger(tx, variantId, -quantity, stockAfter, ctx);
  return stockAfter;
}

/** Puts pieces back (cancellation, expired payment, QC-passed return). */
export async function putBackStock(
  tx: Prisma.TransactionClient,
  variantId: string,
  quantity: number,
  ctx: MovementContext,
): Promise<number | null> {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new RangeError("quantity must be positive");
  const rows = await tx.$queryRaw<{ stock: number }[]>`
    UPDATE "ProductVariant" SET "stock" = "stock" + ${quantity}, "updatedAt" = now()
     WHERE "id" = ${variantId}
    RETURNING "stock"`;
  if (rows.length === 0) return null; // variant deleted since; nothing to restore
  const stockAfter = rows[0]!.stock;
  await writeLedger(tx, variantId, quantity, stockAfter, ctx);
  return stockAfter;
}

/** Staff sets stock to an exact count (stock-take) and the ledger records the difference. */
export async function setStock(
  tx: Prisma.TransactionClient,
  variantId: string,
  newStock: number,
  ctx: MovementContext,
): Promise<{ before: number; after: number } | null> {
  if (!Number.isInteger(newStock) || newStock < 0) throw new RangeError("stock must be 0 or more");
  const rows = await tx.$queryRaw<{ before: number }[]>`
    UPDATE "ProductVariant" v SET "stock" = ${newStock}, "updatedAt" = now()
      FROM (SELECT "id", "stock" FROM "ProductVariant" WHERE "id" = ${variantId} FOR UPDATE) old
     WHERE v."id" = old."id"
    RETURNING old."stock" AS before`;
  if (rows.length === 0) return null;
  const before = rows[0]!.before;
  if (before !== newStock) await writeLedger(tx, variantId, newStock - before, newStock, ctx);
  return { before, after: newStock };
}
