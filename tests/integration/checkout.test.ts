import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { placeOrder } from "@/server/orders/checkout";
import { cancelOrderByCustomer, changeOrderStatus } from "@/server/orders/service";
import { TransitionError } from "@/server/orders/transitions";
import { fillBag, makeCatalogue, makeShopper, resetDatabase, stockOf } from "./fixtures";

/**
 * The money-and-stock paths, against a real PostgreSQL: these are the bugs
 * that only show up when two requests arrive at the same moment.
 */

const order = (addressId: string, key = randomUUID()) => ({
  addressId,
  paymentMethod: "COD" as const,
  customerNote: null,
  idempotencyKey: key,
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("placeOrder", () => {
  it("prices the order from the database and records it completely", async () => {
    const { variant } = await makeCatalogue(5);
    const { user, addressId } = await makeShopper("Asha");
    await fillBag(user.id, variant.id, 2);

    const placed = await placeOrder(user, order(addressId));

    expect(placed.status).toBe("CONFIRMED");
    expect(placed.orderNumber).toBe("HF-100001");
    const saved = await db.order.findUniqueOrThrow({
      where: { orderNumber: placed.orderNumber },
      include: { items: true, statusHistory: true },
    });
    // ₹1,200 × 2 incl. 5% GST, within Rajasthan → CGST + SGST.
    expect(saved.itemsSubtotal).toBe(240_000);
    expect(saved.taxType).toBe("INTRA_STATE");
    expect(saved.cgstTotal + saved.sgstTotal).toBe(240_000 - Math.round((240_000 * 10_000) / 10_500));
    expect(saved.igstTotal).toBe(0);
    expect(saved.grandTotal).toBe(240_000); // free shipping above ₹999 by default
    expect(saved.items).toHaveLength(1);
    expect(saved.items[0]!.hsnCode).toBe("6204");
    expect(saved.statusHistory).toHaveLength(1);
    expect(await stockOf(variant.id)).toBe(3);
    const ledger = await db.inventoryMovement.findMany({ where: { variantId: variant.id } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ change: -2, stockAfter: 3, reason: "ORDER_PLACED", orderId: saved.id });
    expect(await db.cartItem.count({ where: { cart: { userId: user.id } } })).toBe(0);
  });

  it("uses IGST for delivery outside Rajasthan", async () => {
    const { variant } = await makeCatalogue(5);
    const { user, addressId } = await makeShopper("Meera", "27");
    await fillBag(user.id, variant.id, 1);

    const placed = await placeOrder(user, order(addressId));
    const saved = await db.order.findUniqueOrThrow({ where: { orderNumber: placed.orderNumber } });
    expect(saved.taxType).toBe("INTER_STATE");
    expect(saved.cgstTotal + saved.sgstTotal).toBe(0);
    expect(saved.igstTotal).toBeGreaterThan(0);
  });

  it("sells the last piece to exactly one of two simultaneous buyers", async () => {
    const { variant } = await makeCatalogue(1);
    const a = await makeShopper("Asha");
    const b = await makeShopper("Bina");
    await fillBag(a.user.id, variant.id, 1);
    await fillBag(b.user.id, variant.id, 1);

    const results = await Promise.allSettled([
      placeOrder(a.user, order(a.addressId)),
      placeOrder(b.user, order(b.addressId)),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await stockOf(variant.id)).toBe(0);
    expect(await db.order.count()).toBe(1);
    expect(await db.inventoryMovement.count({ where: { reason: "ORDER_PLACED" } })).toBe(1);
  });

  it("never lets a coupon be used more times than its limit", async () => {
    const { variant } = await makeCatalogue(10);
    await db.coupon.create({ data: { code: "ONLYONE", type: "PERCENT", value: 10, usageLimit: 1, perUserLimit: 1 } });
    const shoppers = await Promise.all(["Asha", "Bina", "Chhavi"].map((n) => makeShopper(n)));
    for (const s of shoppers) await fillBag(s.user.id, variant.id, 1, "ONLYONE");

    const results = await Promise.allSettled(shoppers.map((s) => placeOrder(s.user, order(s.addressId))));

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const coupon = await db.coupon.findUniqueOrThrow({ where: { code: "ONLYONE" } });
    expect(coupon.usedCount).toBe(1);
    expect(await db.couponRedemption.count()).toBe(1);
    // Failed orders gave their stock back.
    expect(await stockOf(variant.id)).toBe(9);
  });

  it("returns the same order when the same checkout is submitted twice", async () => {
    const { variant } = await makeCatalogue(5);
    const { user, addressId } = await makeShopper("Asha");
    await fillBag(user.id, variant.id, 1);
    const key = randomUUID();

    const [first, second] = await Promise.all([
      placeOrder(user, order(addressId, key)),
      placeOrder(user, order(addressId, key)),
    ]);

    expect(second.orderNumber).toBe(first.orderNumber);
    expect([first.reused, second.reused].sort()).toEqual([false, true]);
    expect(await db.order.count()).toBe(1);
    expect(await stockOf(variant.id)).toBe(4);
  });

  it("serialises one shopper's simultaneous checkouts (one bag, one order)", async () => {
    const { variant } = await makeCatalogue(5);
    const { user, addressId } = await makeShopper("Asha");
    await fillBag(user.id, variant.id, 1);

    const results = await Promise.allSettled([placeOrder(user, order(addressId)), placeOrder(user, order(addressId))]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.order.count()).toBe(1);
  });

  it("refuses an address that belongs to someone else", async () => {
    const { variant } = await makeCatalogue(5);
    const a = await makeShopper("Asha");
    const b = await makeShopper("Bina");
    await fillBag(a.user.id, variant.id, 1);

    await expect(placeOrder(a.user, order(b.addressId))).rejects.toThrow(/delivery address/i);
    expect(await stockOf(variant.id)).toBe(5);
  });

  it("numbers orders without gaps or repeats", async () => {
    const { variant } = await makeCatalogue(20);
    const shoppers = await Promise.all(["A", "B", "C", "D", "E"].map((n) => makeShopper(`Shopper ${n}`)));
    for (const s of shoppers) await fillBag(s.user.id, variant.id, 1);

    const placed = await Promise.all(shoppers.map((s) => placeOrder(s.user, order(s.addressId))));
    const numbers = placed.map((p) => p.orderNumber).sort();
    expect(numbers).toEqual(["HF-100001", "HF-100002", "HF-100003", "HF-100004", "HF-100005"]);
  });
});

describe("cancelling", () => {
  it("puts stock back and releases the coupon", async () => {
    const { variant } = await makeCatalogue(5);
    await db.coupon.create({ data: { code: "TENOFF", type: "PERCENT", value: 10, usageLimit: 5 } });
    const { user, addressId } = await makeShopper("Asha");
    await fillBag(user.id, variant.id, 2, "TENOFF");
    const placed = await placeOrder(user, order(addressId));
    expect(await stockOf(variant.id)).toBe(3);

    await cancelOrderByCustomer(user, placed.orderNumber, "Ordered the wrong size");

    expect(await stockOf(variant.id)).toBe(5);
    const saved = await db.order.findUniqueOrThrow({
      where: { orderNumber: placed.orderNumber },
      include: { couponRedemption: true, items: true },
    });
    expect(saved.status).toBe("CANCELLED");
    expect(saved.couponRedemption?.releasedAt).not.toBeNull();
    expect(saved.items[0]!.quantityCancelled).toBe(2);
    expect((await db.coupon.findUniqueOrThrow({ where: { code: "TENOFF" } })).usedCount).toBe(0);
    expect(await db.inventoryMovement.count({ where: { reason: "ORDER_CANCELLED", change: 2 } })).toBe(1);
  });

  it("cancels only once when two requests race", async () => {
    const { variant } = await makeCatalogue(5);
    const { user, addressId } = await makeShopper("Asha");
    await fillBag(user.id, variant.id, 2);
    const placed = await placeOrder(user, order(addressId));

    const results = await Promise.allSettled([
      cancelOrderByCustomer(user, placed.orderNumber, null),
      cancelOrderByCustomer(user, placed.orderNumber, null),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await stockOf(variant.id)).toBe(5); // restored once, not twice
  });

  it("rejects a status change made on stale information", async () => {
    const { variant } = await makeCatalogue(5);
    const { user, addressId } = await makeShopper("Asha");
    await fillBag(user.id, variant.id, 1);
    const placed = await placeOrder(user, order(addressId));
    const saved = await db.order.findUniqueOrThrow({ where: { orderNumber: placed.orderNumber } });

    await expect(
      changeOrderStatus(saved.id, "PACKED", { type: "STAFF", user: null }, { expectedFrom: "PROCESSING" }),
    ).rejects.toBeInstanceOf(TransitionError);
    await expect(
      changeOrderStatus(saved.id, "DELIVERED", { type: "STAFF", user: null }, { expectedFrom: "CONFIRMED" }),
    ).rejects.toBeInstanceOf(TransitionError);
  });

  it("marks cash-on-delivery orders paid when delivered", async () => {
    const { variant } = await makeCatalogue(5);
    const { user, addressId } = await makeShopper("Asha");
    await fillBag(user.id, variant.id, 1);
    const placed = await placeOrder(user, order(addressId));
    const { id } = await db.order.findUniqueOrThrow({ where: { orderNumber: placed.orderNumber } });

    const staff = { type: "STAFF" as const, user: null };
    for (const to of ["PROCESSING", "PACKED", "SHIPPED", "DELIVERED"] as const) {
      await changeOrderStatus(id, to, staff);
    }
    const saved = await db.order.findUniqueOrThrow({ where: { id } });
    expect(saved.status).toBe("DELIVERED");
    expect(saved.paymentStatus).toBe("PAID");
    expect(saved.amountPaid).toBe(saved.grandTotal);
  });
});
