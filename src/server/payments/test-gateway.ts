import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { GatewayError, type GatewayPayment, type GatewayRefund, type PaymentGateway } from "./types";
import { checkoutSignature, hmacHex, verifyCheckout, verifyWebhook } from "./signature";

/**
 * Development stand-in for Razorpay. It keeps its "bank" in memory, signs its
 * checkout responses and webhooks exactly as Razorpay does, and is never
 * available in production (see gateway.ts). Refunds are processed instantly.
 */

type Store = {
  orders: Map<string, { amount: number }>;
  payments: Map<string, GatewayPayment>;
  refunds: Map<string, GatewayRefund>;
  /** Test hook: the next refund call fails with this error. */
  nextRefundError: GatewayError | null;
};

// One store per server process, shared by every route bundle (and kept across hot reloads).
const globalStore = globalThis as unknown as { __hfTestGateway?: Store };
const store: Store = (globalStore.__hfTestGateway ??= {
  orders: new Map(),
  payments: new Map(),
  refunds: new Map(),
  nextRefundError: null,
});

// Private to this server: derived from AUTH_SECRET, never configured by hand.
const derive = (label: string) => createHash("sha256").update(`${env.AUTH_SECRET}:test-gateway:${label}`).digest("hex");
const KEY_SECRET = derive("key");
const WEBHOOK_SECRET = derive("webhook");

const newId = (prefix: string) => `${prefix}_TEST${randomBytes(7).toString("hex")}`;

export type SimulatedOutcome = "captured" | "authorized" | "failed";

export class TestGateway implements PaymentGateway {
  readonly name = "TEST" as const;
  readonly keyId = "rzp_test_localgateway";
  readonly webhooksEnabled = true;

  async createOrder(input: { amount: number }) {
    const id = newId("order");
    store.orders.set(id, { amount: input.amount });
    return { id };
  }

  async fetchPayment(paymentId: string) {
    return store.payments.get(paymentId) ?? null;
  }

  async fetchOrderPayments(orderId: string) {
    return [...store.payments.values()].filter((p) => p.orderId === orderId);
  }

  async capture(paymentId: string, amount: number) {
    const payment = store.payments.get(paymentId);
    if (!payment) throw new GatewayError("The id provided does not exist", 400, "BAD_REQUEST_ERROR", false);
    if (payment.status === "captured") {
      throw new GatewayError("This payment has already been captured", 400, "BAD_REQUEST_ERROR", false);
    }
    if (payment.status !== "authorized" || payment.amount !== amount) {
      throw new GatewayError("Only authorized payments can be captured", 400, "BAD_REQUEST_ERROR", false);
    }
    payment.status = "captured";
    return { ...payment };
  }

  async refund(paymentId: string, amount: number, options: { receipt: string }) {
    if (store.nextRefundError) {
      const error = store.nextRefundError;
      store.nextRefundError = null;
      throw error;
    }
    const payment = store.payments.get(paymentId);
    if (!payment || (payment.status !== "captured" && payment.status !== "refunded")) {
      throw new GatewayError("Only captured payments can be refunded", 400, "BAD_REQUEST_ERROR", false);
    }
    if (amount <= 0 || payment.amountRefunded + amount > payment.amount) {
      throw new GatewayError("The total refund amount is greater than the refund payment amount", 400, "BAD_REQUEST_ERROR", false);
    }
    payment.amountRefunded += amount;
    if (payment.amountRefunded === payment.amount) payment.status = "refunded";
    const refund: GatewayRefund = { id: newId("rfnd"), paymentId, amount, status: "processed", receipt: options.receipt };
    store.refunds.set(refund.id, refund);
    return { ...refund };
  }

  async fetchRefunds(paymentId: string) {
    return [...store.refunds.values()].filter((r) => r.paymentId === paymentId);
  }

  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
    return verifyCheckout(KEY_SECRET, orderId, paymentId, signature);
  }

  verifyWebhookSignature(rawBody: string, signature: string) {
    return verifyWebhook(WEBHOOK_SECRET, rawBody, signature);
  }

  /**
   * What happens when the shopper presses a button in the test checkout:
   * the "bank" records the payment, and a signed Razorpay-format webhook is
   * returned for delivery, plus the checkout signature the browser would get.
   */
  simulate(orderId: string, amount: number, outcome: SimulatedOutcome, method = "upi") {
    const payment: GatewayPayment = {
      id: newId("pay"),
      orderId,
      amount,
      currency: "INR",
      status: outcome,
      method,
      amountRefunded: 0,
      errorCode: outcome === "failed" ? "BAD_REQUEST_ERROR" : null,
      errorDescription: outcome === "failed" ? "Payment declined by the bank (test gateway)" : null,
    };
    store.payments.set(payment.id, payment);
    return {
      payment: { ...payment },
      webhook: this.signedEvent(`payment.${outcome}`, "payment", payment),
      checkoutSignature: outcome === "failed" ? null : checkoutSignature(KEY_SECRET, orderId, payment.id),
    };
  }

  /** A Razorpay-format webhook body and its signature. */
  signedEvent(event: string, kind: "payment" | "refund", entity: GatewayPayment | GatewayRefund) {
    const body =
      kind === "payment"
        ? { payment: { entity: toRazorpayPayment(entity as GatewayPayment) } }
        : { refund: { entity: toRazorpayRefund(entity as GatewayRefund) } };
    const rawBody = JSON.stringify({
      entity: "event",
      account_id: "acc_TESTlocal",
      event,
      contains: [kind],
      payload: body,
      created_at: Math.floor(Date.now() / 1000),
    });
    return { rawBody, signature: hmacHex(WEBHOOK_SECRET, rawBody), eventId: newId("evt") };
  }
}

function toRazorpayPayment(p: GatewayPayment) {
  return {
    id: p.id,
    entity: "payment",
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    order_id: p.orderId,
    method: p.method,
    amount_refunded: p.amountRefunded,
    error_code: p.errorCode,
    error_description: p.errorDescription,
  };
}

function toRazorpayRefund(r: GatewayRefund) {
  return { id: r.id, entity: "refund", payment_id: r.paymentId, amount: r.amount, status: r.status, receipt: r.receipt };
}

/** For tests only. */
export const testGatewayControls = {
  failNextRefund(error: GatewayError) {
    store.nextRefundError = error;
  },
  reset() {
    store.orders.clear();
    store.payments.clear();
    store.refunds.clear();
    store.nextRefundError = null;
  },
  /** Mark a payment as captured inside the "bank" without telling the shop (a lost webhook). */
  captureSilently(orderId: string, amount: number, method = "upi"): GatewayPayment {
    const payment: GatewayPayment = {
      id: newId("pay"),
      orderId,
      amount,
      currency: "INR",
      status: "captured",
      method,
      amountRefunded: 0,
      errorCode: null,
      errorDescription: null,
    };
    store.payments.set(payment.id, payment);
    return { ...payment };
  },
  /** The checkout signature the browser would receive for this payment. */
  signCheckout(orderId: string, paymentId: string): string {
    return checkoutSignature(KEY_SECRET, orderId, paymentId);
  },
  setRefundStatus(refundId: string, status: GatewayRefund["status"]) {
    const refund = store.refunds.get(refundId);
    if (refund) refund.status = status;
    return refund ? { ...refund } : null;
  },
};
