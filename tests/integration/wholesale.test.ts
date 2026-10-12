import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { placeOrder } from "@/server/orders/checkout";
import { expireUnpaidOrders } from "@/server/payments/expiry";
import { testGateway } from "@/server/payments/gateway";
import { startPayment } from "@/server/payments/service";
import { testGatewayControls } from "@/server/payments/test-gateway";
import { receiveWebhook } from "@/server/payments/webhooks";
import { outstandingBalance, submitApplication } from "@/server/wholesale/account";
import { reviewApplication } from "@/server/wholesale/admin";
import { reviewBankTransfer, submitBankTransfer } from "@/server/wholesale/bank-transfer";
import { createInquiry } from "@/server/wholesale/inquiry";
import { buyerLedger } from "@/server/wholesale/ledger";
import { fillBag, makeBuyer, makeShopper, makeStaff, makeWholesaleCatalogue, resetDatabase, stockOf } from "./fixtures";

/** Wholesale end to end against a real PostgreSQL. */

const gateway = testGateway()!;

beforeEach(async () => {
  await resetDatabase();
  testGatewayControls.reset();
});

afterAll(async () => {
  await db.$disconnect();
});

const place = (user: SessionUser, addressId: string, paymentMethod: "UPI" | "BANK_TRANSFER" | "CREDIT" | "COD") =>
  placeOrder(user, { addressId, paymentMethod, customerNote: null, idempotencyKey: randomUUID() });

const orderOf = (orderNumber: string) =>
  db.order.findUniqueOrThrow({ where: { orderNumber }, include: { items: true, payments: true, statusHistory: true } });

async function payOnline(user: SessionUser, orderNumber: string) {
  const session = await startPayment(user, orderNumber);
  const result = gateway.simulate(session.providerOrderId, session.amount, "captured");
  await receiveWebhook({ provider: "TEST", ...result.webhook });
  return session;
}

// 10 pcs × ₹800 = ₹8,000 + 5% GST (+ GST pricing) = ₹8,400. Delivery in Rajasthan.
const TEN_PIECES_TOTAL = 840_000;

describe("applying and approval", () => {
  it("a retail customer applies, is approved on a tier, and then pays that tier's prices + GST", async () => {
    const { variant, gold, product } = await makeWholesaleCatalogue(100);
    await db.wholesalePrice.create({ data: { productId: product.id, priceTierId: gold.id, minQuantity: 10, unitPrice: 75_000 } });
    const { user, addressId } = await makeShopper("Asha");
    await db.user.update({ where: { id: user.id }, data: { phone: "+919811122233" } });
    const staff = await makeStaff();

    const applied = await submitApplication(user, {
      businessName: "Asha Boutique",
      legalName: null,
      gstin: "08ABCDE1234F1Z5",
      businessType: "Boutique",
      addressLine: "MI Road",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302001",
      expectedVolume: null,
      socialUrl: null,
    });
    expect(applied.status).toBe("PENDING");
    const profile = await db.wholesaleProfile.findUniqueOrThrow({ where: { userId: user.id } });

    await reviewApplication(staff, profile.id, {
      action: "approve",
      priceTierId: gold.id,
      paymentTerms: "PREPAID",
      advancePercent: null,
      creditLimit: null,
      creditDays: null,
      staffNotes: "Visited the shop",
    });
    const approved = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { wholesaleProfile: true } });
    expect(approved.customerType).toBe("WHOLESALE");
    expect(approved.wholesaleProfile).toMatchObject({ status: "APPROVED", priceTierId: gold.id });

    const buyer: SessionUser = { ...user, customerType: "WHOLESALE", wholesaleStatus: "APPROVED" };
    await fillBag(buyer.id, variant.id, 10);
    const placed = await place(buyer, addressId, "UPI");
    const order = await orderOf(placed.orderNumber);
    expect(order.customerType).toBe("WHOLESALE");
    expect(order.pricesIncludeTax).toBe(false);
    expect(order.items[0]!.unitPrice).toBe(75_000);
    expect(order.grandTotal).toBe(787_500); // ₹7,500 + 5% GST
  });

  it("uses the default tier's prices for a design with none in the buyer's tier", async () => {
    const { variant, gold } = await makeWholesaleCatalogue(100);
    const { user, addressId } = await makeBuyer("Bina", { priceTierId: gold.id });
    await fillBag(user.id, variant.id, 10);
    const order = await orderOf((await place(user, addressId, "UPI")).orderNumber);
    expect(order.items[0]!.unitPrice).toBe(80_000);
  });

  it("sends an approved account back to review when its GSTIN changes", async () => {
    await makeWholesaleCatalogue(10);
    const { user } = await makeBuyer("Chhavi");
    await db.wholesaleProfile.update({ where: { userId: user.id }, data: { gstin: "08ABCDE1234F1Z5" } });

    const result = await submitApplication(user, {
      businessName: "Chhavi Boutique",
      legalName: null,
      gstin: "27AAPFU0939F1ZV",
      businessType: "Boutique",
      addressLine: null,
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      expectedVolume: null,
      socialUrl: null,
    });
    expect(result).toEqual({ status: "PENDING", reReview: true });
    const saved = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { wholesaleProfile: true } });
    expect(saved.customerType).toBe("RETAIL");
    expect(saved.wholesaleProfile!.status).toBe("PENDING");
  });
});

describe("payment terms", () => {
  it("credit: confirmed at once with a due date, and refused beyond the credit limit", async () => {
    const { variant } = await makeWholesaleCatalogue(100);
    const { user, addressId } = await makeBuyer("Deepa", { paymentTerms: "CREDIT", creditLimit: 1_000_000, creditDays: 15 });

    await fillBag(user.id, variant.id, 10);
    const placed = await place(user, addressId, "CREDIT");
    expect(placed.status).toBe("CONFIRMED");
    const order = await orderOf(placed.orderNumber);
    expect(order).toMatchObject({ paymentMethod: "CREDIT", paymentTerms: "CREDIT", paymentStatus: "PENDING", grandTotal: TEN_PIECES_TOTAL });
    const days = (order.balanceDueAt!.getTime() - order.placedAt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(15);
    expect(await outstandingBalance(db, user.id)).toBe(TEN_PIECES_TOTAL);

    // ₹8,400 owed + another ₹8,400 would pass the ₹10,000 limit.
    await fillBag(user.id, variant.id, 10);
    await expect(place(user, addressId, "CREDIT")).rejects.toThrow(/remaining credit/);
    expect(await stockOf(variant.id)).toBe(90);
  });

  it("advance + balance: the advance confirms the order, the balance is paid later", async () => {
    const { variant } = await makeWholesaleCatalogue(100);
    const { user, addressId } = await makeBuyer("Esha", { paymentTerms: "ADVANCE_BALANCE", advancePercent: 30 });
    await fillBag(user.id, variant.id, 10);
    const placed = await place(user, addressId, "UPI");
    let order = await orderOf(placed.orderNumber);
    expect(order.advanceAmount).toBe(252_000);

    const first = await payOnline(user, placed.orderNumber);
    expect(first.amount).toBe(252_000);
    order = await orderOf(placed.orderNumber);
    expect(order.status).toBe("CONFIRMED");
    expect(order.paymentStatus).toBe("PARTIALLY_PAID");
    expect(await outstandingBalance(db, user.id)).toBe(TEN_PIECES_TOTAL - 252_000);

    const second = await payOnline(user, placed.orderNumber);
    expect(second.amount).toBe(TEN_PIECES_TOTAL - 252_000);
    order = await orderOf(placed.orderNumber);
    expect(order.paymentStatus).toBe("PAID");
    expect(order.amountPaid).toBe(TEN_PIECES_TOTAL);
    expect((await buyerLedger(user.id)).summary.outstanding).toBe(0);
  });

  it("bank transfer: stock held, UTR reported, kept through expiry, confirmed by staff", async () => {
    const { variant } = await makeWholesaleCatalogue(100);
    const { user, addressId } = await makeBuyer("Farah");
    const staff = await makeStaff();
    await fillBag(user.id, variant.id, 10);

    const placed = await place(user, addressId, "BANK_TRANSFER");
    expect(placed.status).toBe("PENDING_PAYMENT");
    let order = await orderOf(placed.orderNumber);
    const holdHours = (order.paymentDueBy!.getTime() - order.placedAt.getTime()) / 3_600_000;
    expect(Math.round(holdHours)).toBe(48);
    expect(await stockOf(variant.id)).toBe(90);

    await submitBankTransfer(user, { orderNumber: placed.orderNumber, amount: TEN_PIECES_TOTAL, reference: "UTR123456789" });
    await expect(
      submitBankTransfer(user, { orderNumber: placed.orderNumber, amount: TEN_PIECES_TOTAL, reference: "UTR123456789" }),
    ).rejects.toThrow();
    order = await orderOf(placed.orderNumber);
    const transfer = order.payments.find((p) => p.provider === "MANUAL")!;
    expect(transfer).toMatchObject({ status: "CREATED", method: "BANK_TRANSFER", manualReference: "UTR123456789" });
    expect(transfer.attentionReason).toMatch(/Bank transfer to verify/);

    // The window ends while staff haven't checked yet: the order is not released.
    await db.order.update({ where: { id: order.id }, data: { paymentDueBy: new Date(Date.now() - 60 * 60_000) } });
    expect(await expireUnpaidOrders()).toBe(0);
    expect((await orderOf(placed.orderNumber)).status).toBe("PENDING_PAYMENT");

    await reviewBankTransfer(staff, { paymentId: transfer.id, approve: true, reason: null });
    order = await orderOf(placed.orderNumber);
    expect(order.status).toBe("CONFIRMED");
    expect(order.paymentStatus).toBe("PAID");
    expect(order.payments.find((p) => p.id === transfer.id)).toMatchObject({ status: "CAPTURED", verifiedById: staff.id, attentionReason: null });
    await expect(reviewBankTransfer(staff, { paymentId: transfer.id, approve: true, reason: null })).rejects.toThrow(/already been reviewed/);
  });

  it("a rejected transfer confirms nothing and tells the buyer why", async () => {
    const { variant } = await makeWholesaleCatalogue(100);
    const { user, addressId } = await makeBuyer("Gita");
    const staff = await makeStaff();
    await fillBag(user.id, variant.id, 10);
    const placed = await place(user, addressId, "BANK_TRANSFER");
    await submitBankTransfer(user, { orderNumber: placed.orderNumber, amount: TEN_PIECES_TOTAL, reference: "WRONG12345" });
    const transfer = (await orderOf(placed.orderNumber)).payments[0]!;

    await reviewBankTransfer(staff, { paymentId: transfer.id, approve: false, reason: "No transfer with this UTR has arrived" });

    const order = await orderOf(placed.orderNumber);
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(order.amountPaid).toBe(0);
    expect(order.payments[0]!.status).toBe("FAILED");
    expect(order.statusHistory.some((h) => h.isCustomerVisible && /No transfer with this UTR/.test(h.note ?? ""))).toBe(true);
  });

  it("retail shoppers can't choose bank transfer or credit, and wholesale COD needs the setting", async () => {
    const { variant } = await makeWholesaleCatalogue(100);
    const retail = await makeShopper("Hema");
    await fillBag(retail.user.id, variant.id, 1);
    await expect(place(retail.user, retail.addressId, "BANK_TRANSFER")).rejects.toThrow(/isn't available for your account/);
    await expect(place(retail.user, retail.addressId, "CREDIT")).rejects.toThrow(/isn't available for your account/);

    const buyer = await makeBuyer("Indu", { paymentTerms: "PREPAID" });
    await fillBag(buyer.user.id, variant.id, 10);
    await expect(place(buyer.user, buyer.addressId, "COD")).rejects.toThrow(/isn't available for your account/);
    await expect(place(buyer.user, buyer.addressId, "CREDIT")).rejects.toThrow(/isn't available for your account/);
    expect(await stockOf(variant.id)).toBe(100);
  });
});

describe("enquiries", () => {
  it("makes one lead when the same number sends the form twice", async () => {
    const lead = {
      name: "Jaya",
      phone: "+919800011122",
      email: null,
      businessName: "Jaya Fashions",
      city: "Surat",
      categoriesOfInterest: ["Kurtis"],
      message: "Need 200 pcs",
      source: "wholesale-page",
    };
    await createInquiry(lead);
    await createInquiry({ ...lead, message: "Need 300 pcs" });
    const rows = await db.wholesaleInquiry.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.message).toBe("Need 300 pcs");
  });
});
