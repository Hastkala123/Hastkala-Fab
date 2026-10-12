import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

/** Empties every table (the test database only). */
export async function resetDatabase(): Promise<void> {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

export async function makeCatalogue(stock: number) {
  const hsn = await db.hsnCode.create({ data: { code: "6204", description: "Kurtis (test)" } });
  await db.taxRule.createMany({
    data: [
      { hsnCodeId: hsn.id, minUnitValue: 0, maxUnitValue: 250_000, rateBps: 500, effectiveFrom: new Date("2025-09-22") },
      { hsnCodeId: hsn.id, minUnitValue: 250_001, maxUnitValue: null, rateBps: 1800, effectiveFrom: new Date("2025-09-22") },
    ],
  });
  const category = await db.category.create({ data: { name: "Kurtis", slug: "kurtis", hsnCodeId: hsn.id } });
  const product = await db.product.create({
    data: {
      title: "Test Indigo Kurti",
      slug: "test-indigo-kurti",
      description: "A test product used by the integration tests.",
      categoryId: category.id,
      status: "ACTIVE",
      printTechnique: "HAND_BLOCK",
      mrp: 150_000,
      price: 120_000,
    },
  });
  const variant = await db.productVariant.create({
    data: { productId: product.id, sku: "TEST-KURTI-M", size: "M", stock },
  });
  return { category, product, variant };
}

export async function makeShopper(name: string, stateCode = "08"): Promise<{ user: SessionUser; addressId: string }> {
  const record = await db.user.create({
    data: {
      name,
      email: `${name.toLowerCase().replace(/\W+/g, "")}-${randomUUID().slice(0, 8)}@example.test`,
      addresses: {
        create: {
          fullName: name,
          phone: "+919876543210",
          line1: "12 Block Printers Lane",
          city: stateCode === "08" ? "Jaipur" : "Mumbai",
          state: stateCode === "08" ? "Rajasthan" : "Maharashtra",
          stateCode,
          pincode: stateCode === "08" ? "302029" : "400001",
          isDefault: true,
        },
      },
    },
    include: { addresses: true },
  });
  const user: SessionUser = {
    id: record.id,
    email: record.email,
    phone: null,
    name: record.name,
    isStaff: false,
    isOwner: false,
    permissions: [],
    customerType: "RETAIL",
    wholesaleStatus: null,
    sessionId: "test-session",
  };
  return { user, addressId: record.addresses[0]!.id };
}

export async function fillBag(userId: string, variantId: string, quantity: number, couponCode: string | null = null) {
  await db.cart.upsert({
    where: { userId },
    create: { userId, couponCode, items: { create: { variantId, quantity } } },
    update: { couponCode, items: { deleteMany: {}, create: { variantId, quantity } } },
  });
}

export const stockOf = async (variantId: string) =>
  (await db.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } })).stock;

/** A wholesale design: Standard tier 10+ @ ₹800, 50+ @ ₹700 (+ GST), with a Gold tier existing. */
export async function makeWholesaleCatalogue(stock: number) {
  const made = await makeCatalogue(stock);
  const [standard, gold] = await Promise.all([
    db.priceTier.create({ data: { name: "Standard", isDefault: true } }),
    db.priceTier.create({ data: { name: "Gold" } }),
  ]);
  await db.product.update({ where: { id: made.product.id }, data: { wholesaleEnabled: true, wholesaleMinQty: 10 } });
  await db.wholesalePrice.createMany({
    data: [
      { productId: made.product.id, priceTierId: standard.id, minQuantity: 10, unitPrice: 80_000 },
      { productId: made.product.id, priceTierId: standard.id, minQuantity: 50, unitPrice: 70_000 },
    ],
  });
  return { ...made, standard, gold };
}

/** An approved wholesale buyer on the given terms. */
export async function makeBuyer(
  name: string,
  profile: {
    priceTierId?: string | null;
    paymentTerms?: "PREPAID" | "ADVANCE_BALANCE" | "CREDIT";
    advancePercent?: number | null;
    creditLimit?: number | null;
    creditDays?: number | null;
  } = {},
): Promise<{ user: SessionUser; addressId: string }> {
  const shopper = await makeShopper(name);
  await db.user.update({
    where: { id: shopper.user.id },
    data: {
      customerType: "WHOLESALE",
      phone: `+9198${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
      wholesaleProfile: {
        create: { businessName: `${name} Boutique`, city: "Jaipur", status: "APPROVED", ...profile },
      },
    },
  });
  return {
    user: { ...shopper.user, customerType: "WHOLESALE", wholesaleStatus: "APPROVED" },
    addressId: shopper.addressId,
  };
}

export async function makeStaff(): Promise<SessionUser> {
  const staff = await db.user.create({
    data: { name: "Owner", email: `owner-${randomUUID().slice(0, 8)}@example.test`, isStaff: true },
  });
  return {
    id: staff.id,
    email: staff.email,
    phone: null,
    name: staff.name,
    isStaff: true,
    isOwner: true,
    permissions: [],
    customerType: "RETAIL",
    wholesaleStatus: null,
    sessionId: "staff-session",
  };
}
