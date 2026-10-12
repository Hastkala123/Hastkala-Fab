import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { gatewayFor } from "./gateway";
import { razorpayPaymentSchema, razorpayRefundSchema, toGatewayPayment, toGatewayRefund } from "./razorpay";
import { flagPayment, applyGatewayRefund } from "./refunds";
import { applyGatewayPayment } from "./service";
import type { GatewayName } from "./types";

/**
 * Inbound payment webhooks. Signature first (HMAC of the raw body, compared
 * in constant time), then the event is stored under its id — a repeated
 * delivery finds it already processed and does nothing. Failures return 500
 * so the gateway retries; events we don't recognise are acknowledged and
 * kept, so a new Razorpay event type can never get our webhook disabled.
 */

const eventSchema = z.object({
  event: z.string().max(100),
  payload: z.object({
    payment: z.object({ entity: razorpayPaymentSchema }).optional(),
    refund: z.object({ entity: razorpayRefundSchema }).optional(),
  }),
});

type WebhookEvent = z.infer<typeof eventSchema>;
export type WebhookResult = { status: number; body: Record<string, unknown> };

export async function receiveWebhook(input: {
  provider: GatewayName;
  rawBody: string;
  signature: string | null;
  eventId: string | null;
}): Promise<WebhookResult> {
  const gateway = gatewayFor(input.provider);
  if (!gateway || !gateway.webhooksEnabled) {
    return { status: 503, body: { error: "Webhooks are not configured" } };
  }
  if (!input.signature || !gateway.verifyWebhookSignature(input.rawBody, input.signature)) {
    console.warn(`[webhook] ${input.provider}: rejected a request with a missing or wrong signature`);
    return { status: 400, body: { error: "Invalid signature" } };
  }

  let json: unknown = null;
  try {
    json = JSON.parse(input.rawBody);
  } catch {
    // handled below as unrecognised
  }
  const parsed = eventSchema.safeParse(json);
  const rawType = (json as { event?: unknown } | null)?.event;
  const eventType = parsed.success ? parsed.data.event : typeof rawType === "string" ? rawType.slice(0, 100) : "unknown";
  const eventId =
    input.eventId && /^[\w-]{1,100}$/.test(input.eventId)
      ? input.eventId
      : `sha256:${createHash("sha256").update(input.rawBody).digest("hex")}`;
  const provider = input.provider.toLowerCase();

  // Only the fields we use are kept (no customer email, phone or card data).
  const payload = (parsed.success ? parsed.data : { event: eventType }) as Prisma.InputJsonObject;
  let record;
  try {
    record = await db.webhookEvent.upsert({
      where: { provider_eventId: { provider, eventId } },
      create: { provider, eventId, eventType, payload, signatureValid: true },
      update: {},
    });
  } catch (error) {
    // The same event delivered twice at the same moment.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      record = await db.webhookEvent.findUniqueOrThrow({ where: { provider_eventId: { provider, eventId } } });
    } else {
      throw error;
    }
  }
  if (record.processedAt) return { status: 200, body: { ok: true, duplicate: true } };

  if (!parsed.success) {
    await db.webhookEvent.update({
      where: { id: record.id },
      data: { processedAt: new Date(), attempts: { increment: 1 }, error: "Not a payment or refund event we handle; ignored" },
    });
    return { status: 200, body: { ok: true, ignored: true } };
  }

  try {
    await handleEvent(input.provider, parsed.data);
    await db.webhookEvent.update({
      where: { id: record.id },
      data: { processedAt: new Date(), attempts: { increment: 1 }, error: null },
    });
    return { status: 200, body: { ok: true } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[webhook] ${input.provider} ${eventType} failed:`, error);
    await db.webhookEvent
      .update({ where: { id: record.id }, data: { attempts: { increment: 1 }, error: message.slice(0, 1000) } })
      .catch(() => undefined);
    return { status: 500, body: { error: "Processing failed; please retry" } };
  }
}

async function handleEvent(provider: GatewayName, event: WebhookEvent): Promise<void> {
  const { payment, refund } = event.payload;

  if (event.event.startsWith("payment.dispute.") && payment) {
    const row = await db.payment.findUnique({ where: { providerPaymentId: payment.entity.id }, select: { id: true } });
    if (row) {
      await db.$transaction((tx) =>
        flagPayment(tx, row.id, `Customer raised a dispute (${event.event.replace("payment.dispute.", "")})`),
      );
    }
    return;
  }
  if ((event.event.startsWith("payment.") || event.event === "order.paid") && payment) {
    await applyGatewayPayment(provider, toGatewayPayment(payment.entity));
    return;
  }
  if (event.event.startsWith("refund.") && refund) {
    await applyGatewayRefund(provider, toGatewayRefund(refund.entity));
  }
}
