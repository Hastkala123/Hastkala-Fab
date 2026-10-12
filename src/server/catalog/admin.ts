import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { mediaKeyFromUrl } from "@/lib/upload";
import type { ProductInput } from "@/lib/validators";
import { NotFoundError, UserError } from "@/server/errors";
import { setStock } from "@/server/inventory/stock";

/**
 * Admin → Products. Everything about a product is edited in one form and
 * saved here in one transaction: details, photos, sizes/colours with stock,
 * wholesale prices and filter attributes. Stock changes go through the
 * inventory ledger, so every adjustment is on record.
 */

async function defaultTierId(tx: Prisma.TransactionClient): Promise<string> {
  const tier = await tx.priceTier.findFirst({ where: { isDefault: true }, select: { id: true } });
  if (tier) return tier.id;
  const created = await tx.priceTier.create({ data: { name: "Standard", isDefault: true } });
  return created.id;
}

async function checkReferences(input: ProductInput) {
  const [category, hsn, definitions] = await Promise.all([
    db.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }),
    input.hsnCodeId ? db.hsnCode.findUnique({ where: { id: input.hsnCodeId }, select: { id: true } }) : null,
    db.attributeDefinition.findMany({
      where: { id: { in: Object.keys(input.attributes) } },
      select: { id: true, type: true, options: true, categoryId: true },
    }),
  ]);
  if (!category) throw new UserError("Please correct the highlighted fields", 422, { categoryId: "Choose a category." });
  if (input.hsnCodeId && !hsn) throw new UserError("Please correct the highlighted fields", 422, { hsnCodeId: "Choose a valid HSN code." });
  for (const url of input.media.map((m) => m.url)) {
    if (!mediaKeyFromUrl(url)) throw new UserError("One of the photos wasn't uploaded here. Re-upload it and try again.", 422);
  }
  return definitions;
}

function attributeRows(
  input: ProductInput,
  definitions: Awaited<ReturnType<typeof checkReferences>>,
): Prisma.ProductAttributeValueCreateManyProductInput[] {
  const rows: Prisma.ProductAttributeValueCreateManyProductInput[] = [];
  for (const def of definitions) {
    const raw = input.attributes[def.id];
    const values = (Array.isArray(raw) ? raw : [raw ?? ""]).map((v) => v.trim()).filter(Boolean);
    for (const value of [...new Set(values)]) {
      if ((def.type === "SELECT" || def.type === "MULTI_SELECT") && def.options.length && !def.options.includes(value)) {
        throw new UserError(`"${value}" isn't one of the options for this attribute. Add it in Admin → Attributes first.`, 422);
      }
      const numeric = def.type === "NUMBER" ? Number(value) : null;
      if (def.type === "NUMBER" && !Number.isFinite(numeric)) {
        throw new UserError(`"${value}" must be a number.`, 422);
      }
      rows.push({
        attributeId: def.id,
        value,
        numericValue: numeric != null ? new Prisma.Decimal(numeric) : null,
      });
      if (def.type !== "MULTI_SELECT") break;
    }
  }
  return rows;
}

function scalarData(input: ProductInput) {
  return {
    title: input.title,
    slug: input.slug,
    shortDescription: input.shortDescription,
    description: input.description,
    categoryId: input.categoryId,
    status: input.status,
    publishAt: input.publishAt,
    printTechnique: input.printTechnique,
    hsnCodeId: input.hsnCodeId,
    price: input.price,
    mrp: input.mrp,
    wholesaleEnabled: input.wholesaleEnabled,
    wholesaleMinQty: input.wholesaleMinQty,
    weightGrams: input.weightGrams,
    careInstructions: input.careInstructions,
    isReturnable: input.isReturnable,
    isCodAllowed: input.isCodAllowed,
    isFeatured: input.isFeatured,
    isNewArrival: input.isNewArrival,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
    searchKeywords: input.searchKeywords,
  } satisfies Prisma.ProductUncheckedUpdateInput;
}

function translateUniqueError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = String((error.meta as { target?: unknown } | undefined)?.target ?? "");
    if (target.includes("slug")) {
      throw new UserError("Please correct the highlighted fields", 409, { slug: "Another product already uses this web address." });
    }
    if (target.includes("sku")) {
      throw new UserError("Please correct the highlighted fields", 409, { variants: "One of these SKUs is already used by another product." });
    }
  }
  throw error;
}

export async function saveProduct(input: ProductInput, staff: SessionUser, productId?: string): Promise<{ id: string; slug: string }> {
  const definitions = await checkReferences(input);
  const attributes = attributeRows(input, definitions);
  const before = productId
    ? await db.product.findUnique({
        where: { id: productId },
        include: { variants: { select: { id: true, sku: true, stock: true, price: true, isActive: true } } },
      })
    : null;
  if (productId && !before) throw new NotFoundError("Product not found");

  try {
    const saved = await db.$transaction(
      async (tx) => {
        let id: string;
        if (productId) {
          await tx.product.update({ where: { id: productId }, data: scalarData(input) });
          id = productId;
        } else {
          const last = await tx.product.aggregate({ where: { categoryId: input.categoryId }, _max: { position: true } });
          const created = await tx.product.create({
            data: { ...scalarData(input), position: (last._max.position ?? -1) + 1 },
            select: { id: true },
          });
          id = created.id;
        }

        // Photos: replaced in the order the owner arranged them.
        await tx.productMedia.deleteMany({ where: { productId: id } });
        if (input.media.length) {
          await tx.productMedia.createMany({
            data: input.media.map((m, position) => ({
              productId: id,
              url: m.url,
              storageKey: mediaKeyFromUrl(m.url)!,
              alt: m.alt ?? input.title,
              position,
            })),
          });
        }

        // Wholesale prices: the standard tier, plus any other tier given its own.
        const tierId = await defaultTierId(tx);
        const otherTiers = await tx.priceTier.findMany({ where: { id: { not: tierId } }, select: { id: true } });
        await tx.wholesalePrice.deleteMany({ where: { productId: id } });
        const rows = [
          ...input.wholesalePrices.map((w) => ({ productId: id, priceTierId: tierId, ...w })),
          ...otherTiers.flatMap((t) =>
            (input.wholesaleEnabled ? (input.tierPrices[t.id] ?? []) : []).map((w) => ({ productId: id, priceTierId: t.id, ...w })),
          ),
        ];
        if (rows.length) await tx.wholesalePrice.createMany({ data: rows });

        // Attributes (fabric, occasion, …) drive the shop filters.
        await tx.productAttributeValue.deleteMany({ where: { productId: id } });
        if (attributes.length) {
          await tx.productAttributeValue.createMany({ data: attributes.map((a) => ({ ...a, productId: id })) });
        }

        // Sizes/colours. Removed ones are archived, not deleted: past orders
        // and the stock ledger still point at them.
        const existing = new Map((before?.variants ?? []).map((v) => [v.id, v]));
        const bySku = new Map((before?.variants ?? []).map((v) => [v.sku, v.id]));
        const keep = new Set<string>();
        for (const [position, raw] of input.variants.entries()) {
          // A size removed earlier and added back with the same SKU revives the old row.
          const v = raw.id ? raw : { ...raw, id: bySku.get(raw.sku) };
          const fields = {
            sku: v.sku,
            size: v.size,
            colorName: v.colorName,
            colorHex: v.colorHex,
            packQuantity: v.packQuantity,
            label: v.label,
            price: v.price,
            mrp: v.mrp,
            lowStockThreshold: v.lowStockThreshold,
            isActive: v.isActive,
            archivedAt: null,
            position,
          };
          if (v.id && existing.has(v.id)) {
            keep.add(v.id);
            await tx.productVariant.update({ where: { id: v.id }, data: fields });
            await setStock(tx, v.id, v.stock, { reason: "ADJUSTMENT", actorId: staff.id, note: "Edited in product form" });
          } else {
            const created = await tx.productVariant.create({ data: { ...fields, productId: id, stock: v.stock } });
            if (v.stock > 0) {
              await tx.inventoryMovement.create({
                data: { variantId: created.id, change: v.stock, stockAfter: v.stock, reason: "INITIAL", actorId: staff.id },
              });
            }
          }
        }
        const removed = [...existing.keys()].filter((vid) => !keep.has(vid));
        if (removed.length) {
          await tx.productVariant.updateMany({
            where: { id: { in: removed } },
            data: { isActive: false, archivedAt: new Date() },
          });
          await tx.cartItem.deleteMany({ where: { variantId: { in: removed } } });
        }

        return tx.product.findUniqueOrThrow({ where: { id }, select: { id: true, slug: true } });
      },
      { timeout: 30_000 },
    );

    await audit({
      actor: staff,
      action: productId ? "product.update" : "product.create",
      entityType: "Product",
      entityId: saved.id,
      before: before
        ? { title: before.title, status: before.status, price: before.price, mrp: before.mrp, variants: before.variants }
        : undefined,
      after: {
        title: input.title,
        status: input.status,
        price: input.price,
        mrp: input.mrp,
        variants: input.variants.map((v) => ({ sku: v.sku, stock: v.stock, price: v.price })),
      },
    });
    return saved;
  } catch (error) {
    if (error instanceof UserError) throw error;
    translateUniqueError(error);
  }
}

/** Products are archived, never deleted: orders and invoices refer to them. */
export async function archiveProduct(productId: string, staff: SessionUser): Promise<void> {
  const product = await db.product.findUnique({ where: { id: productId }, select: { status: true } });
  if (!product) throw new NotFoundError("Product not found");
  await db.product.update({ where: { id: productId }, data: { status: "ARCHIVED" } });
  await audit({
    actor: staff,
    action: "product.archive",
    entityType: "Product",
    entityId: productId,
    before: { status: product.status },
    after: { status: "ARCHIVED" },
  });
}

/** Saves a drag-and-drop order: position = index in the list. */
export async function reorder(
  model: "product" | "category",
  ids: string[],
  staff: SessionUser,
): Promise<void> {
  await db.$transaction(
    ids.map((id, position) =>
      model === "product"
        ? db.product.updateMany({ where: { id }, data: { position } })
        : db.category.updateMany({ where: { id }, data: { position } }),
    ),
  );
  await audit({ actor: staff, action: `${model}.reorder`, entityType: model === "product" ? "Product" : "Category", after: { ids } });
}
