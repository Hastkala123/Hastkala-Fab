import "server-only";

import { z } from "zod";
import { GatewayError, type GatewayPayment, type GatewayRefund, type PaymentGateway } from "./types";
import { verifyCheckout, verifyWebhook } from "./signature";

/**
 * Thin Razorpay REST client (https://razorpay.com/docs/api/). Only the calls
 * the shop needs; every response is validated before use.
 */

const API = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 15_000;

export const razorpayPaymentSchema = z.object({
  id: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.enum(["created", "authorized", "captured", "refunded", "failed"]),
  order_id: z.string().nullish(),
  method: z.string().nullish(),
  amount_refunded: z.number().int().nullish(),
  error_code: z.string().nullish(),
  error_description: z.string().nullish(),
});

export const razorpayRefundSchema = z.object({
  id: z.string(),
  payment_id: z.string(),
  amount: z.number().int(),
  status: z.enum(["pending", "processed", "failed"]),
  receipt: z.string().nullish(),
});

const collection = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item) });

export function toGatewayPayment(p: z.infer<typeof razorpayPaymentSchema>): GatewayPayment {
  return {
    id: p.id,
    orderId: p.order_id ?? null,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    method: p.method ?? null,
    amountRefunded: p.amount_refunded ?? 0,
    errorCode: p.error_code ?? null,
    errorDescription: p.error_description ?? null,
  };
}

export function toGatewayRefund(r: z.infer<typeof razorpayRefundSchema>): GatewayRefund {
  return { id: r.id, paymentId: r.payment_id, amount: r.amount, status: r.status, receipt: r.receipt ?? null };
}

export class RazorpayGateway implements PaymentGateway {
  readonly name = "RAZORPAY" as const;
  readonly webhooksEnabled: boolean;
  private readonly auth: string;

  constructor(
    readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string | undefined,
  ) {
    this.auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
    this.webhooksEnabled = Boolean(webhookSecret);
  }

  get isLive(): boolean {
    return this.keyId.startsWith("rzp_live_");
  }

  private async call<T extends z.ZodType>(
    method: "GET" | "POST",
    path: string,
    schema: T,
    body?: unknown,
  ): Promise<z.infer<T>> {
    let response: Response;
    try {
      response = await fetch(`${API}${path}`, {
        method,
        headers: { Authorization: this.auth, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      throw new GatewayError(`Razorpay could not be reached: ${(error as Error).message}`, 0, null, true);
    }

    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const err = (json as { error?: { code?: string; description?: string } } | null)?.error;
      // 4xx (except rate limiting) means the request itself is wrong: retrying won't help.
      const retryable = response.status >= 500 || response.status === 429;
      throw new GatewayError(
        err?.description ?? `Razorpay returned ${response.status}`,
        response.status,
        err?.code ?? null,
        retryable,
      );
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new GatewayError("Razorpay sent a response we did not understand", response.status, null, true);
    }
    return parsed.data;
  }

  async createOrder(input: { amount: number; receipt: string; notes: Record<string, string> }) {
    const order = await this.call("POST", "/orders", z.object({ id: z.string() }), {
      amount: input.amount,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
    });
    return { id: order.id };
  }

  async fetchPayment(paymentId: string): Promise<GatewayPayment | null> {
    try {
      return toGatewayPayment(await this.call("GET", `/payments/${encodeURIComponent(paymentId)}`, razorpayPaymentSchema));
    } catch (error) {
      if (error instanceof GatewayError && error.status === 404) return null;
      throw error;
    }
  }

  async fetchOrderPayments(orderId: string): Promise<GatewayPayment[]> {
    const list = await this.call(
      "GET",
      `/orders/${encodeURIComponent(orderId)}/payments`,
      collection(razorpayPaymentSchema),
    );
    return list.items.map(toGatewayPayment);
  }

  async capture(paymentId: string, amount: number): Promise<GatewayPayment> {
    return toGatewayPayment(
      await this.call("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, razorpayPaymentSchema, {
        amount,
        currency: "INR",
      }),
    );
  }

  async refund(paymentId: string, amount: number, options: { receipt: string; notes: Record<string, string> }) {
    return toGatewayRefund(
      await this.call("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, razorpayRefundSchema, {
        amount,
        speed: "normal",
        receipt: options.receipt.slice(0, 40),
        notes: options.notes,
      }),
    );
  }

  async fetchRefunds(paymentId: string): Promise<GatewayRefund[]> {
    const list = await this.call(
      "GET",
      `/payments/${encodeURIComponent(paymentId)}/refunds?count=100`,
      collection(razorpayRefundSchema),
    );
    return list.items.map(toGatewayRefund);
  }

  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
    return verifyCheckout(this.keySecret, orderId, paymentId, signature);
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    return this.webhookSecret ? verifyWebhook(this.webhookSecret, rawBody, signature) : false;
  }
}
