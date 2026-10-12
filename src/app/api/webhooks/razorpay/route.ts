import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { receiveWebhook } from "@/server/payments/webhooks";

export const runtime = "nodejs";

const MAX_BYTES = 1_000_000;

/**
 * Razorpay → us. No session or CSRF token (Razorpay has neither); the HMAC
 * signature over the raw body is the authentication.
 */
export const POST = handler(async (request) => {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) {
    return NextResponse.json({ error: "Too large" }, { status: 413 });
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BYTES) {
    return NextResponse.json({ error: "Too large" }, { status: 413 });
  }
  const result = await receiveWebhook({
    provider: "RAZORPAY",
    rawBody,
    signature: request.headers.get("x-razorpay-signature"),
    eventId: request.headers.get("x-razorpay-event-id"),
  });
  return NextResponse.json(result.body, { status: result.status });
});
