import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { placeOrder } from "@/server/orders/checkout";
import { trackOrder, TRACK_NOT_FOUND } from "@/server/orders/track";
import { deletePage, reorderFaqs, saveFaq, savePage } from "@/server/content/admin";
import { contentValues, publishedFaqs } from "@/server/content/pages";
import { getSettings } from "@/server/settings";
import { fillBag, makeCatalogue, makeShopper, makeStaff, resetDatabase } from "./fixtures";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await db.$disconnect();
});

async function placedOrder() {
  const { variant } = await makeCatalogue(5);
  const { user, addressId } = await makeShopper("Meera");
  await fillBag(user.id, variant.id, 1);
  const placed = await placeOrder(user, { addressId, paymentMethod: "COD", customerNote: null, idempotencyKey: randomUUID() });
  return { user, placed };
}

describe("trackOrder", () => {
  it("finds an order by its number and the email it was placed with", async () => {
    const { user, placed } = await placedOrder();
    const tracked = await trackOrder({ orderNumber: placed.orderNumber, contact: user.email!.toUpperCase() });
    expect(tracked.orderNumber).toBe(placed.orderNumber);
    expect(tracked.statusLabel).toBeTruthy();
    expect(tracked.items).toEqual([expect.objectContaining({ title: "Test Indigo Kurti", quantity: 1 })]);
    expect(tracked.history.length).toBeGreaterThan(0);
    // Nothing personal beyond status and items.
    expect(JSON.stringify(tracked)).not.toContain("Block Printers Lane");
  });

  it("accepts the delivery mobile number in any spelling", async () => {
    const { placed } = await placedOrder();
    const tracked = await trackOrder({ orderNumber: placed.orderNumber, contact: "098765 43210" });
    expect(tracked.orderNumber).toBe(placed.orderNumber);
  });

  it("gives the same answer for a wrong contact and a missing order", async () => {
    const { placed } = await placedOrder();
    await expect(trackOrder({ orderNumber: placed.orderNumber, contact: "someone@example.test" })).rejects.toThrow(TRACK_NOT_FOUND);
    await expect(trackOrder({ orderNumber: placed.orderNumber, contact: "9123456789" })).rejects.toThrow(TRACK_NOT_FOUND);
    await expect(trackOrder({ orderNumber: "HF-999999", contact: "someone@example.test" })).rejects.toThrow(TRACK_NOT_FOUND);
    await expect(trackOrder({ orderNumber: placed.orderNumber, contact: "not a contact" })).rejects.toThrow(TRACK_NOT_FOUND);
  });
});

const page = (slug: string, status: "DRAFT" | "PUBLISHED" = "PUBLISHED") => ({
  title: "Terms & Conditions",
  slug,
  type: "POLICY" as const,
  status,
  body: "## Terms\nHello",
  metaTitle: null,
  metaDescription: null,
  showInFooter: true,
});

describe("pages", () => {
  it("keeps the address of a fixed page and never lists it twice in the footer", async () => {
    const staff = await makeStaff();
    const created = await savePage(staff, page("terms"));
    const saved = await db.page.findUniqueOrThrow({ where: { id: created.id } });
    expect(saved.showInFooter).toBe(false);
    expect(saved.publishedAt).not.toBeNull();
    expect(saved.updatedById).toBe(staff.id);

    await expect(savePage(staff, page("my-terms"), created.id)).rejects.toMatchObject({ fields: { slug: expect.any(String) } });
    await expect(deletePage(staff, created.id)).rejects.toThrow(/can't be deleted/);
  });

  it("refuses a second page at the same address", async () => {
    const staff = await makeStaff();
    await savePage(staff, page("size-guide"));
    await expect(savePage(staff, page("size-guide"))).rejects.toMatchObject({ fields: { slug: expect.any(String) } });
  });

  it("deletes an extra page", async () => {
    const staff = await makeStaff();
    const created = await savePage(staff, page("size-guide", "DRAFT"));
    await deletePage(staff, created.id);
    expect(await db.page.count()).toBe(0);
  });
});

describe("FAQs", () => {
  it("groups active questions in the owner's order", async () => {
    const staff = await makeStaff();
    const a = await saveFaq(staff, { question: "How long is delivery?", answer: "A few days.", group: "Orders", isActive: true });
    const b = await saveFaq(staff, { question: "Can I return it?", answer: "Yes.", group: "Returns", isActive: true });
    const c = await saveFaq(staff, { question: "Do you ship abroad?", answer: "Not yet.", group: "Orders", isActive: true });
    await saveFaq(staff, { question: "Hidden question?", answer: "Hidden.", group: "Orders", isActive: false });
    await reorderFaqs(staff, [b.id, c.id, a.id]);

    const groups = await publishedFaqs();
    expect(groups.map((g) => g.name)).toEqual(["Returns", "Orders"]);
    expect(groups[1]!.items.map((f) => f.question)).toEqual(["Do you ship abroad?", "How long is delivery?"]);
  });
});

describe("contentValues", () => {
  it("writes policy sentences from the settings checkout uses", async () => {
    const settings = await getSettings();
    const values = contentValues({
      ...settings,
      shipping: { ...settings.shipping, retailFee: 7_900, freeShippingThreshold: 99_900 },
      cod: { ...settings.cod, enabled: true, maxOrderValue: 1_000_000 },
      returns: { ...settings.returns, windowDays: 0 },
    });
    expect(values.shippingCharges).toBe("Shipping is free on orders of ₹999 and above; below that it costs ₹79.");
    expect(values.codAvailability).toBe("Cash on Delivery is available on retail orders up to ₹10,000.");
    expect(values.returnDays).toBe("");
    expect(values.exchangeNote).toBe("");
  });
});
