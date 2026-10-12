import "server-only";

import type { PaymentProvider } from "@prisma/client";
import { env, isProd } from "@/lib/env";
import { RazorpayGateway } from "./razorpay";
import { TestGateway } from "./test-gateway";
import type { PaymentGateway } from "./types";

/**
 * Which gateway takes new payments: Razorpay when its keys are set; otherwise
 * the test gateway in development; otherwise none (online payment is then
 * hidden at checkout — the stand-in can never take a real order).
 */

let razorpay: RazorpayGateway | null | undefined;
let test: TestGateway | null | undefined;

function razorpayGateway(): RazorpayGateway | null {
  if (razorpay === undefined) {
    razorpay =
      env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
        ? new RazorpayGateway(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET, env.RAZORPAY_WEBHOOK_SECRET)
        : null;
  }
  return razorpay;
}

export function testGateway(): TestGateway | null {
  if (test === undefined) test = isProd ? null : new TestGateway();
  return test;
}

/** The gateway new payments go through, or null when online payment is unavailable. */
export function activeGateway(): PaymentGateway | null {
  return razorpayGateway() ?? testGateway();
}

/** The gateway that took an earlier payment (for refunds and status checks). */
export function gatewayFor(provider: PaymentProvider): PaymentGateway | null {
  if (provider === "RAZORPAY") return razorpayGateway();
  if (provider === "TEST") return testGateway();
  return null;
}

export type GatewayStatus =
  | { mode: "live" | "test-keys"; webhooks: boolean }
  | { mode: "stand-in" }
  | { mode: "off" };

/** For the admin dashboard and settings page. */
export function gatewayStatus(): GatewayStatus {
  const rp = razorpayGateway();
  if (rp) return { mode: rp.isLive ? "live" : "test-keys", webhooks: rp.webhooksEnabled };
  return testGateway() ? { mode: "stand-in" } : { mode: "off" };
}
