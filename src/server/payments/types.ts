import type { PaymentMethod } from "@prisma/client";

/**
 * The payment gateway as the rest of the app sees it. Razorpay and the
 * development test gateway both implement this, so checkout, webhooks,
 * expiry and refunds run the same code whichever one is active.
 */

export type GatewayName = "RAZORPAY" | "TEST";

/** A payment attempt as the gateway reports it (Razorpay's payment entity). */
export type GatewayPayment = {
  id: string;
  /** The gateway order it belongs to (null for payments we didn't create). */
  orderId: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string | null;
  amountRefunded: number;
  errorCode: string | null;
  errorDescription: string | null;
};

export type GatewayRefund = {
  id: string;
  paymentId: string;
  amount: number;
  status: "pending" | "processed" | "failed";
  /** Our refund number, sent when the refund was created. */
  receipt: string | null;
};

export interface PaymentGateway {
  readonly name: GatewayName;
  /** Public key for the browser checkout. */
  readonly keyId: string;
  /** Whether inbound webhooks can be verified (Razorpay needs its webhook secret). */
  readonly webhooksEnabled: boolean;

  createOrder(input: { amount: number; receipt: string; notes: Record<string, string> }): Promise<{ id: string }>;
  fetchPayment(paymentId: string): Promise<GatewayPayment | null>;
  fetchOrderPayments(orderId: string): Promise<GatewayPayment[]>;
  capture(paymentId: string, amount: number): Promise<GatewayPayment>;
  refund(
    paymentId: string,
    amount: number,
    options: { receipt: string; notes: Record<string, string> },
  ): Promise<GatewayRefund>;
  fetchRefunds(paymentId: string): Promise<GatewayRefund[]>;

  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
}

/** A gateway call that failed. `retryable` = worth trying again later. */
export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

/** Razorpay's method names → ours. Unknown methods keep the order's choice. */
export function mapGatewayMethod(method: string | null | undefined): PaymentMethod | null {
  switch (method) {
    case "upi":
      return "UPI";
    case "card":
      return "CARD";
    case "netbanking":
      return "NETBANKING";
    case "wallet":
    case "paylater":
      return "WALLET";
    case "emi":
    case "cardless_emi":
      return "EMI";
    case "bank_transfer":
      return "BANK_TRANSFER";
    default:
      return null;
  }
}
