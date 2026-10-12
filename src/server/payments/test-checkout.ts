import "server-only";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { NotFoundError, UserError } from "@/server/errors";
import { activeGateway, testGateway } from "./gateway";
import { receiveWebhook } from "./webhooks";

/**
 * The test gateway's "payment page" buttons (development only). The result
 * travels the same road as a real payment: a signed webhook through
 * receiveWebhook(), then the browser confirms with a signed response.
 */
export async function simulateTestPayment(
  user: SessionUser,
  input: { orderNumber: string; providerOrderId: string; outcome: "captured" | "failed" },
) {
  const gateway = testGateway();
  if (!gateway || activeGateway()?.name !== "TEST") throw new NotFoundError("Not found");

  const order = await db.order.findFirst({
    where: { orderNumber: input.orderNumber, userId: user.id },
    select: { id: true, status: true },
  });
  if (!order) throw new NotFoundError("Order not found");
  const attempt = await db.payment.findFirst({
    where: { orderId: order.id, provider: "TEST", providerOrderId: input.providerOrderId },
    select: { amount: true },
  });
  if (!attempt) throw new UserError("This payment window is out of date. Close it and try again.", 409);
  // Awaiting payment, or a confirmed wholesale order paying its balance.
  if (["CANCELLED", "RTO_IN_TRANSIT", "RTO_DELIVERED"].includes(order.status)) {
    throw new UserError("This order can no longer be paid.", 409);
  }

  const result = gateway.simulate(input.providerOrderId, attempt.amount, input.outcome);
  const delivered = await receiveWebhook({ provider: "TEST", ...result.webhook });
  if (delivered.status !== 200) throw new Error(`Test webhook was not accepted (${delivered.status})`);

  return input.outcome === "failed"
    ? { failed: true as const, description: result.payment.errorDescription ?? "Payment failed" }
    : { failed: false as const, providerPaymentId: result.payment.id, signature: result.checkoutSignature! };
}
