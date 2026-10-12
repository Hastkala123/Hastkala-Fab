import { describe, expect, it } from "vitest";
import { backoffMs } from "@/server/jobs/backoff";
import { checkoutSignature, hmacHex, safeEqualHex, verifyCheckout, verifyWebhook } from "@/server/payments/signature";
import { ATTEMPT_RANK, attemptStatusAfterRefunds, orderPaymentStatus } from "@/server/payments/status";
import { mapGatewayMethod } from "@/server/payments/types";

describe("Razorpay signatures", () => {
  // Expected values computed independently with Python's hmac module.
  it("signs checkout responses as HMAC-SHA256 of order_id|payment_id", () => {
    expect(checkoutSignature("test_key_secret_123", "order_IluGWxBm9U8zJ8", "pay_IluGZkyGTSOsUT")).toBe(
      "be175d16439e4d61b4151dae996661b326e59092c4a28766ea4ebb1968abdf7d",
    );
  });

  it("signs webhooks as HMAC-SHA256 of the raw body", () => {
    expect(hmacHex("whsec_test", '{"event":"payment.captured"}')).toBe(
      "4f463a57dd128675850163391f0311888616d57bccca75c774c9cdb28134f851",
    );
  });

  it("accepts only the exact signature", () => {
    const good = checkoutSignature("secret", "order_A", "pay_B");
    expect(verifyCheckout("secret", "order_A", "pay_B", good)).toBe(true);
    expect(verifyCheckout("secret", "order_A", "pay_B", good.toUpperCase())).toBe(true);
    expect(verifyCheckout("secret", "order_A", "pay_C", good)).toBe(false);
    expect(verifyCheckout("other", "order_A", "pay_B", good)).toBe(false);
    expect(verifyCheckout("secret", "order_A", "pay_B", good.slice(0, 63))).toBe(false);
    expect(verifyCheckout("secret", "order_A", "pay_B", "zz" + good.slice(2))).toBe(false);
    expect(verifyCheckout("secret", "order_A", "pay_B", "")).toBe(false);
  });

  it("rejects a webhook body changed after signing", () => {
    const body = '{"event":"payment.captured","amount":100}';
    const signature = hmacHex("whsec", body);
    expect(verifyWebhook("whsec", body, signature)).toBe(true);
    expect(verifyWebhook("whsec", body.replace("100", "1"), signature)).toBe(false);
  });

  it("compares in constant time without throwing on odd input", () => {
    expect(safeEqualHex("abcd", "abcd")).toBe(true);
    expect(safeEqualHex("abcd", "abc")).toBe(false);
    expect(safeEqualHex("abcd", "ab-d")).toBe(false);
  });
});

describe("order payment status", () => {
  const base = { grandTotal: 100_000, unpaidStatus: "PENDING" as const };

  it("is pending or failed while nothing is paid", () => {
    expect(orderPaymentStatus({ ...base, amountPaid: 0, amountRefunded: 0 })).toBe("PENDING");
    expect(orderPaymentStatus({ ...base, unpaidStatus: "FAILED", amountPaid: 0, amountRefunded: 0 })).toBe("FAILED");
  });

  it("follows money in and out", () => {
    expect(orderPaymentStatus({ ...base, amountPaid: 100_000, amountRefunded: 0 })).toBe("PAID");
    expect(orderPaymentStatus({ ...base, amountPaid: 40_000, amountRefunded: 0 })).toBe("PARTIALLY_PAID");
    expect(orderPaymentStatus({ ...base, amountPaid: 100_000, amountRefunded: 30_000 })).toBe("PARTIALLY_REFUNDED");
    expect(orderPaymentStatus({ ...base, amountPaid: 100_000, amountRefunded: 100_000 })).toBe("REFUNDED");
  });

  it("stays paid when a duplicate payment was refunded", () => {
    expect(orderPaymentStatus({ ...base, amountPaid: 200_000, amountRefunded: 100_000 })).toBe("PAID");
  });

  it("tracks each attempt's refunds", () => {
    expect(attemptStatusAfterRefunds(5000, 0)).toBe("CAPTURED");
    expect(attemptStatusAfterRefunds(5000, 1000)).toBe("PARTIALLY_REFUNDED");
    expect(attemptStatusAfterRefunds(5000, 5000)).toBe("REFUNDED");
  });

  it("lets a failed attempt still succeed later, never the reverse", () => {
    expect(ATTEMPT_RANK.FAILED).toBeLessThan(ATTEMPT_RANK.AUTHORIZED);
    expect(ATTEMPT_RANK.CAPTURED).toBeGreaterThan(ATTEMPT_RANK.FAILED);
  });
});

describe("gateway helpers", () => {
  it("maps Razorpay methods to ours", () => {
    expect(mapGatewayMethod("upi")).toBe("UPI");
    expect(mapGatewayMethod("card")).toBe("CARD");
    expect(mapGatewayMethod("netbanking")).toBe("NETBANKING");
    expect(mapGatewayMethod("cardless_emi")).toBe("EMI");
    expect(mapGatewayMethod("something_new")).toBeNull();
    expect(mapGatewayMethod(null)).toBeNull();
  });

  it("backs off retries up to an hour", () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(3)).toBe(120_000);
    expect(backoffMs(20)).toBe(3_600_000);
  });
});
