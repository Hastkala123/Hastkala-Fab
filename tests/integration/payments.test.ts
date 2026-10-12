import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { placeOrder } from "@/server/orders/checkout";
import { cancelOrderByCustomer } from "@/server/orders/service";
import { runDueJobs } from "@/server/jobs/runner";
import { expireOrderIfDue, expireUnpaidOrders } from "@/server/payments/expiry";
import { testGateway } from "@/server/payments/gateway";
import { retryRefund } from "@/server/payments/refunds";
import { confirmCheckoutPayment, startPayment } from "@/server/payments/service";
import { testGatewayControls } from "@/server/payments/test-gateway";
import { GatewayError } from "@/server/payments/types";
import { receiveWebhook } from "@/server/payments/webhooks";
import { fillBag, makeCatalogue, makeShopper, resetDatabase, stockOf } from "./fixtures";

/**
 * Online payments end to end against a real PostgreSQL, through the test
 * gateway (which signs its webhooks and responses exactly as Razorpay does).
 */

const gateway = testGateway()!;

beforeEach(async () => {
  await resetDatabase();
  testGatewayControls.reset();
});

afterAll(async () => {
  await db.$disconnect();
});

async function onlineOrder(options: { stock?: number; quantity?: number; coupon?: string } = {}) {
  const { variant } = await makeCatalogue(options.stock ?? 5);
  const { user, addressId } = await makeShopper("Asha");
  await fillBag(user.id, variant.id, options.quantity ?? 1, options.coupon ?? null);
  const placed = await placeOrder(user, {
    addressId,
    paymentMethod: "UPI",
    customerNote: null,
    idempotencyKey: randomUUID(),
  });
  expect(placed.status).toBe("PENDING_PAYMENT");
  const order = await db.order.findUniqueOrThrow({ where: { orderNumber: placed.orderNumber } });
  return { user, variant, order };
}

/** The shopper presses "Pay" in the test gateway: the signed webhook is delivered. */
async function pay(user: SessionUser, orderNumber: string, outcome: "captured" | "failed" | "authorized" = "captured") {
  const session = await startPayment(user, orderNumber);
  const result = gateway.simulate(session.providerOrderId, session.amount, outcome);
  const delivered = await receiveWebhook({ provider: "TEST", ...result.webhook });
  return { session, result, delivered };
}

const reload = (id: string) =>
  db.order.findUniqueOrThrow({ where: { id }, include: { payments: true, refunds: true, statusHistory: true } });

/** Pretends the payment window ended a while ago. */
const windowEnded = (id: string) =>
  db.order.update({ where: { id }, data: { paymentDueBy: new Date(Date.now() - 10 * 60_000) } });

describe("taking a payment", () => {
  it("confirms the order only when the gateway reports the money captured", async () => {
    const { user, order } = await onlineOrder();
    expect(order.paymentDueBy).not.toBeNull();

    const { delivered } = await pay(user, order.orderNumber);

    expect(delivered.status).toBe(200);
    const saved = await reload(order.id);
    expect(saved.status).toBe("CONFIRMED");
    expect(saved.paymentStatus).toBe("PAID");
    expect(saved.amountPaid).toBe(saved.grandTotal);
    expect(saved.confirmedAt).not.toBeNull();
    expect(saved.payments).toHaveLength(1);
    expect(saved.payments[0]).toMatchObject({ status: "CAPTURED", provider: "TEST", method: "UPI", amount: saved.grandTotal });
    expect(saved.statusHistory.some((h) => h.toStatus === "CONFIRMED" && h.note?.startsWith("Payment of"))).toBe(true);
  });

  it("counts a payment once however many times it is reported", async () => {
    const { user, order } = await onlineOrder();
    const { session, result } = await pay(user, order.orderNumber);

    // The same webhook again, the browser's confirmation, and a fresh event for the same payment.
    const again = await receiveWebhook({ provider: "TEST", ...result.webhook });
    expect(again.body).toMatchObject({ duplicate: true });
    await confirmCheckoutPayment(user, {
      orderNumber: order.orderNumber,
      providerOrderId: session.providerOrderId,
      providerPaymentId: result.payment.id,
      signature: result.checkoutSignature!,
    });
    await receiveWebhook({ provider: "TEST", ...gateway.signedEvent("order.paid", "payment", result.payment) });

    const saved = await reload(order.id);
    expect(saved.amountPaid).toBe(saved.grandTotal);
    expect(saved.payments).toHaveLength(1);
    expect(saved.statusHistory.filter((h) => h.toStatus === "CONFIRMED")).toHaveLength(1);
    expect(await db.webhookEvent.count()).toBe(2);
  });

  it("rejects a webhook whose signature is wrong, and stores nothing", async () => {
    const { user, order } = await onlineOrder();
    const session = await startPayment(user, order.orderNumber);
    const forged = gateway.simulate(session.providerOrderId, session.amount, "captured").webhook;

    const result = await receiveWebhook({ provider: "TEST", ...forged, signature: "0".repeat(64) });

    expect(result.status).toBe(400);
    expect(await db.webhookEvent.count()).toBe(0);
    expect((await reload(order.id)).status).toBe("PENDING_PAYMENT");
  });

  it("never trusts the browser: a bad signature or an unpaid payment confirms nothing", async () => {
    const { user, order } = await onlineOrder();
    const session = await startPayment(user, order.orderNumber);
    const failed = gateway.simulate(session.providerOrderId, session.amount, "failed");

    await expect(
      confirmCheckoutPayment(user, {
        orderNumber: order.orderNumber,
        providerOrderId: session.providerOrderId,
        providerPaymentId: failed.payment.id,
        signature: "a".repeat(64),
      }),
    ).rejects.toThrow(/couldn't verify/i);

    // Even a correctly signed id is only as good as the gateway's own record of it.
    const result = await confirmCheckoutPayment(user, {
      orderNumber: order.orderNumber,
      providerOrderId: session.providerOrderId,
      providerPaymentId: failed.payment.id,
      signature: testGatewayControls.signCheckout(session.providerOrderId, failed.payment.id),
    });
    expect(result.paid).toBe(false);
    const saved = await reload(order.id);
    expect(saved.status).toBe("PAYMENT_FAILED");
    expect(saved.amountPaid).toBe(0);
  });

  it("captures an authorised payment while the order still wants it", async () => {
    const { user, order } = await onlineOrder();
    await pay(user, order.orderNumber, "authorized");

    const saved = await reload(order.id);
    expect(saved.status).toBe("CONFIRMED");
    expect(saved.payments[0]!.status).toBe("CAPTURED");
  });

  it("lets the shopper retry after a failed attempt, on the same gateway order", async () => {
    const { user, order } = await onlineOrder();

    const first = await pay(user, order.orderNumber, "failed");
    let saved = await reload(order.id);
    expect(saved.status).toBe("PAYMENT_FAILED");
    expect(saved.paymentStatus).toBe("FAILED");
    expect(saved.payments[0]!.failureReason).toMatch(/declined/i);

    const second = await pay(user, order.orderNumber, "captured");
    expect(second.session.providerOrderId).toBe(first.session.providerOrderId);
    saved = await reload(order.id);
    expect(saved.status).toBe("CONFIRMED");
    expect(saved.paymentStatus).toBe("PAID");
    expect(saved.payments.map((p) => p.status).sort()).toEqual(["CAPTURED", "FAILED"]);
    expect(saved.statusHistory.map((h) => h.toStatus)).toEqual([
      "PENDING_PAYMENT",
      "PAYMENT_FAILED",
      "PENDING_PAYMENT",
      "CONFIRMED",
    ]);
  });

  it("opens one gateway order when Pay is pressed twice at once", async () => {
    const { user, order } = await onlineOrder();
    const [a, b] = await Promise.all([startPayment(user, order.orderNumber), startPayment(user, order.orderNumber)]);
    expect(a.providerOrderId).toBe(b.providerOrderId);
    expect(await db.payment.count()).toBe(1);
  });

  it("refunds a second payment for an order that is already paid", async () => {
    const { user, order } = await onlineOrder();
    const { session } = await pay(user, order.orderNumber);
    const duplicate = gateway.simulate(session.providerOrderId, session.amount, "captured");
    await receiveWebhook({ provider: "TEST", ...duplicate.webhook });
    await runDueJobs();

    const saved = await reload(order.id);
    expect(saved.status).toBe("CONFIRMED");
    expect(saved.paymentStatus).toBe("PAID");
    expect(saved.amountPaid).toBe(2 * saved.grandTotal);
    expect(saved.amountRefunded).toBe(saved.grandTotal);
    expect(saved.refunds).toHaveLength(1);
    expect(saved.refunds[0]!.status).toBe("COMPLETED");
    expect(saved.payments.find((p) => p.providerPaymentId === duplicate.payment.id)!.attentionReason).toMatch(/extra payment/i);
  });

  it("refuses to take payment for someone else's order", async () => {
    const { order } = await onlineOrder();
    const { user: stranger } = await makeShopper("Bina");
    await expect(startPayment(stranger, order.orderNumber)).rejects.toThrow(/not found/i);
  });
});

describe("unpaid orders", () => {
  it("are cancelled when the window ends, giving back stock and the coupon", async () => {
    await db.coupon.create({ data: { code: "TENOFF", type: "PERCENT", value: 10, usageLimit: 5 } });
    const { order, variant } = await onlineOrder({ quantity: 2, coupon: "TENOFF" });
    expect(await stockOf(variant.id)).toBe(3);

    // Not yet: inside the window nothing happens.
    expect(await expireUnpaidOrders()).toBe(0);
    await windowEnded(order.id);
    expect(await expireUnpaidOrders()).toBe(1);

    const saved = await reload(order.id);
    expect(saved.status).toBe("CANCELLED");
    expect(saved.cancelReason).toBe("Payment not completed in time");
    expect(await stockOf(variant.id)).toBe(5);
    expect(await db.inventoryMovement.count({ where: { reason: "ORDER_EXPIRED", change: 2 } })).toBe(1);
    expect((await db.coupon.findUniqueOrThrow({ where: { code: "TENOFF" } })).usedCount).toBe(0);
    expect(saved.refunds).toHaveLength(0);
  });

  it("are confirmed, not cancelled, when the gateway has the money but its webhook was lost", async () => {
    const { user, order, variant } = await onlineOrder();
    const session = await startPayment(user, order.orderNumber);
    testGatewayControls.captureSilently(session.providerOrderId, session.amount);
    await windowEnded(order.id);

    expect(await expireUnpaidOrders()).toBe(0);

    const saved = await reload(order.id);
    expect(saved.status).toBe("CONFIRMED");
    expect(saved.paymentStatus).toBe("PAID");
    expect(await stockOf(variant.id)).toBe(4);
  });

  it("refund in full a payment that arrives after the order expired", async () => {
    const { user, order, variant } = await onlineOrder();
    const session = await startPayment(user, order.orderNumber);
    await windowEnded(order.id);
    await expireUnpaidOrders();
    expect(await stockOf(variant.id)).toBe(5);

    const late = gateway.simulate(session.providerOrderId, session.amount, "captured");
    await receiveWebhook({ provider: "TEST", ...late.webhook });
    await runDueJobs();

    const saved = await reload(order.id);
    expect(saved.status).toBe("CANCELLED");
    expect(saved.amountPaid).toBe(session.amount);
    expect(saved.amountRefunded).toBe(session.amount);
    expect(saved.paymentStatus).toBe("REFUNDED");
    expect(saved.refunds).toHaveLength(1);
    expect(saved.refunds[0]).toMatchObject({ status: "COMPLETED", amount: session.amount });
    expect(saved.statusHistory.some((h) => h.isCustomerVisible && /refunded in full/.test(h.note ?? ""))).toBe(true);
    expect(await stockOf(variant.id)).toBe(5);
  });

  it("end consistent when the payment and the expiry arrive at the same moment", async () => {
    for (let round = 0; round < 5; round++) {
      await resetDatabase();
      const { user, order, variant } = await onlineOrder();
      const session = await startPayment(user, order.orderNumber);
      await windowEnded(order.id);
      const paid = gateway.simulate(session.providerOrderId, session.amount, "captured");

      await Promise.allSettled([expireOrderIfDue(order.id), receiveWebhook({ provider: "TEST", ...paid.webhook })]);
      await runDueJobs();

      const saved = await reload(order.id);
      const refunded = saved.refunds.reduce((sum, r) => sum + r.amount, 0);
      if (saved.status === "CONFIRMED") {
        expect(refunded).toBe(0);
        expect(await stockOf(variant.id)).toBe(4);
      } else {
        expect(saved.status).toBe("CANCELLED");
        expect(refunded).toBe(saved.amountPaid);
        expect(await stockOf(variant.id)).toBe(5);
      }
      expect(saved.amountPaid).toBe(session.amount);
    }
  });
});

describe("refunds", () => {
  it("are automatic when a paid order is cancelled", async () => {
    const { user, order, variant } = await onlineOrder();
    await pay(user, order.orderNumber);

    await cancelOrderByCustomer(user, order.orderNumber, "Ordered the wrong size");
    let saved = await reload(order.id);
    expect(saved.refunds).toHaveLength(1);
    expect(saved.refunds[0]!.status).toBe("INITIATED");
    expect(saved.refunds[0]!.refundNumber).toBe("RFD-100001");
    expect(saved.paymentStatus).toBe("REFUNDED");

    await runDueJobs();
    saved = await reload(order.id);
    expect(saved.refunds[0]!.status).toBe("COMPLETED");
    expect(saved.refunds[0]!.providerRefundId).toMatch(/^rfnd_TEST/);
    expect(saved.payments[0]!.status).toBe("REFUNDED");
    expect(saved.statusHistory.some((h) => h.isCustomerVisible && /processed to your original payment method/.test(h.note ?? ""))).toBe(true);
    expect(await stockOf(variant.id)).toBe(5);
    expect(await db.job.count({ where: { status: "SUCCEEDED", type: "refund.submit" } })).toBe(1);
  });

  it("that the gateway rejects are released, flagged, and can be retried", async () => {
    const { user, order } = await onlineOrder();
    await pay(user, order.orderNumber);
    testGatewayControls.failNextRefund(new GatewayError("Refunds are disabled on this account", 400, "BAD_REQUEST_ERROR", false));

    await cancelOrderByCustomer(user, order.orderNumber, null);
    await runDueJobs();
    let saved = await reload(order.id);
    expect(saved.refunds[0]!.status).toBe("FAILED");
    expect(saved.refunds[0]!.failureReason).toMatch(/disabled/);
    expect(saved.amountRefunded).toBe(0);
    expect(saved.paymentStatus).toBe("PAID");
    expect(saved.payments[0]!.attentionReason).toMatch(/RFD-100001 failed/);

    await retryRefund(saved.refunds[0]!.id);
    await runDueJobs();
    saved = await reload(order.id);
    expect(saved.refunds[0]!.status).toBe("COMPLETED");
    expect(saved.amountRefunded).toBe(saved.amountPaid);
    expect(saved.paymentStatus).toBe("REFUNDED");
  });

  it("are retried with back-off when the gateway is briefly down", async () => {
    const { user, order } = await onlineOrder();
    await pay(user, order.orderNumber);
    testGatewayControls.failNextRefund(new GatewayError("Gateway timeout", 504, null, true));

    await cancelOrderByCustomer(user, order.orderNumber, null);
    await runDueJobs();
    const job = await db.job.findFirstOrThrow({ where: { type: "refund.submit" } });
    expect(job.status).toBe("FAILED");
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now());
    expect((await reload(order.id)).refunds[0]!.status).toBe("INITIATED");

    await db.job.update({ where: { id: job.id }, data: { runAt: new Date() } });
    await runDueJobs();
    expect((await reload(order.id)).refunds[0]!.status).toBe("COMPLETED");
  });

  it("made in the gateway's dashboard are added to our books", async () => {
    const { user, order } = await onlineOrder();
    const { result } = await pay(user, order.orderNumber);
    const outside = await gateway.refund(result.payment.id, 50_000, { receipt: "dashboard" });

    await receiveWebhook({ provider: "TEST", ...gateway.signedEvent("refund.processed", "refund", outside) });

    const saved = await reload(order.id);
    expect(saved.refunds).toHaveLength(1);
    expect(saved.refunds[0]).toMatchObject({ status: "COMPLETED", amount: 50_000, providerRefundId: outside.id });
    expect(saved.amountRefunded).toBe(50_000);
    expect(saved.paymentStatus).toBe("PARTIALLY_REFUNDED");
  });
});
