import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC-SHA256 as lowercase hex — Razorpay's signature format. */
export function hmacHex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

/** Constant-time comparison, so response timing can't reveal a valid signature. */
export function safeEqualHex(expected: string, received: string): boolean {
  if (!/^[0-9a-f]+$/i.test(received) || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received.toLowerCase(), "hex"));
}

/** Browser checkout: signature = HMAC(order_id + "|" + payment_id, key secret). */
export function checkoutSignature(keySecret: string, orderId: string, paymentId: string): string {
  return hmacHex(keySecret, `${orderId}|${paymentId}`);
}

export function verifyCheckout(keySecret: string, orderId: string, paymentId: string, signature: string): boolean {
  return safeEqualHex(checkoutSignature(keySecret, orderId, paymentId), signature);
}

/** Webhooks: signature = HMAC(raw request body, webhook secret). */
export function verifyWebhook(webhookSecret: string, rawBody: string, signature: string): boolean {
  return safeEqualHex(hmacHex(webhookSecret, rawBody), signature);
}
