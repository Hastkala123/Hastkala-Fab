"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { formatPrice } from "@/lib/money";
import { orderThankYouPath } from "@/lib/routes";
import { useToast } from "@/components/ui/Toast";

/**
 * Opens the payment window for an order: Razorpay Checkout, or the test
 * gateway's dialog in development. The server decides which, and confirms
 * the result with the gateway itself.
 */

type Session = {
  gateway: "razorpay" | "test";
  keyId: string;
  providerOrderId: string;
  amount: number;
  orderNumber: string;
  storeName: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  secondsLeft: number;
};

export type PaymentOutcome =
  | { kind: "paid" }
  /** The gateway took the payment; we're waiting for it to be confirmed. */
  | { kind: "processing" }
  | { kind: "closed" }
  | { kind: "error"; message: string };

type CheckoutResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayInstance = { open(): void; on(event: string, callback: (response: unknown) => void): void };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      script.remove();
      reject(new Error("Payment window failed to load"));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

async function confirmPayment(session: Session, response: CheckoutResponse): Promise<PaymentOutcome> {
  const result = await apiRequest<{ paid: boolean }>("/api/payments/verify", {
    body: {
      orderNumber: session.orderNumber,
      providerOrderId: response.razorpay_order_id,
      providerPaymentId: response.razorpay_payment_id,
      signature: response.razorpay_signature,
    },
  });
  if (!result.ok) return { kind: "error", message: result.error };
  return result.data.paid ? { kind: "paid" } : { kind: "processing" };
}

export function usePayment() {
  const [busy, setBusy] = useState(false);
  const [testRun, setTestRun] = useState<{ session: Session; resolve: (outcome: PaymentOutcome) => void } | null>(null);

  const pay = useCallback(async (orderNumber: string): Promise<PaymentOutcome> => {
    setBusy(true);
    try {
      const started = await apiRequest<Session>("/api/payments/start", { body: { orderNumber } });
      if (!started.ok) return { kind: "error", message: started.error };
      const session = started.data;

      if (session.gateway === "test") {
        return await new Promise<PaymentOutcome>((resolve) => setTestRun({ session, resolve }));
      }

      try {
        await loadCheckoutScript();
      } catch {
        return { kind: "error", message: "The payment window couldn't load. Check your connection and try again." };
      }
      return await new Promise<PaymentOutcome>((resolve) => {
        let settled = false;
        const finish = (outcome: PaymentOutcome) => {
          if (settled) return;
          settled = true;
          resolve(outcome);
        };
        const checkout = new window.Razorpay!({
          key: session.keyId,
          order_id: session.providerOrderId,
          amount: session.amount,
          currency: "INR",
          name: session.storeName,
          description: session.description,
          prefill: session.prefill,
          notes: { orderNumber: session.orderNumber },
          theme: { color: "#1e3a5f" },
          // The window closes when the stock hold ends.
          timeout: session.secondsLeft,
          retry: { enabled: true },
          modal: { ondismiss: () => finish({ kind: "closed" }), confirm_close: true },
          handler: (response: CheckoutResponse) => {
            void confirmPayment(session, response).then(finish);
          },
        });
        // A failed attempt is shown inside the window, which offers a retry.
        checkout.on("payment.failed", () => undefined);
        checkout.open();
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const dialog = testRun ? (
    <TestGatewayDialog
      session={testRun.session}
      onDone={(outcome) => {
        testRun.resolve(outcome);
        setTestRun(null);
      }}
    />
  ) : null;

  return { pay, busy: busy || testRun !== null, dialog };
}

/**
 * What to do once the payment window is done. From checkout the shopper
 * always lands on the order's thank-you page; from the order page it
 * refreshes in place.
 */
export function useFinishPayment(from: "checkout" | "order") {
  const router = useRouter();
  const { toast } = useToast();

  return useCallback(
    async (orderNumber: string, outcome: PaymentOutcome) => {
      let result = outcome;
      if (result.kind === "closed") {
        // A UPI payment can finish after the window is closed: ask once.
        const check = await apiRequest<{ paid: boolean }>("/api/payments/status", { body: { orderNumber } });
        if (check.ok && check.data.paid) result = { kind: "paid" };
      }
      const thankYou = orderThankYouPath(orderNumber);
      if (result.kind === "paid") {
        toast("Payment received — your order is confirmed", "success");
        router.replace(thankYou);
      } else if (result.kind === "processing") {
        router.replace(`${thankYou}?confirming=1`);
      } else {
        if (result.kind === "error") toast(result.message, "error");
        if (from === "checkout") router.replace(thankYou);
      }
      router.refresh();
    },
    [router, toast, from],
  );
}

function TestGatewayDialog({ session, onDone }: { session: Session; onDone: (outcome: PaymentOutcome) => void }) {
  const [pending, setPending] = useState<"captured" | "failed" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const payButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    payButton.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onDone({ kind: "closed" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, onDone]);

  async function simulate(outcome: "captured" | "failed") {
    setPending(outcome);
    setError(null);
    const result = await apiRequest<
      { failed: true; description: string } | { failed: false; providerPaymentId: string; signature: string }
    >("/api/payments/test", {
      body: { orderNumber: session.orderNumber, providerOrderId: session.providerOrderId, outcome },
    });
    if (!result.ok) {
      setPending(null);
      setError(result.error);
      return;
    }
    if (result.data.failed) {
      setPending(null);
      setError(result.data.description);
      return;
    }
    onDone(
      await confirmPayment(session, {
        razorpay_order_id: session.providerOrderId,
        razorpay_payment_id: result.data.providerPaymentId,
        razorpay_signature: result.data.signature,
      }),
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-indigo-ink-950/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-gateway-title"
        className="w-full max-w-sm rounded-card bg-white p-6 shadow-xl"
      >
        <p className="text-xs font-bold uppercase tracking-wide text-turmeric-800">Test gateway · development only</p>
        <h2 id="test-gateway-title" className="mt-1 font-display text-2xl font-bold text-indigo-ink-950">
          Pay {formatPrice(session.amount)}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {session.description} · {session.storeName}
        </p>
        <p className="mt-4 rounded-lg bg-cotton-100 p-3 text-xs leading-relaxed text-slate-600">
          No real money moves. This stands in for Razorpay until its keys are added, and confirms the order through the
          same signed webhook Razorpay sends.
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-madder-50 p-3 text-sm text-madder-800">
            {error} You can try again.
          </p>
        )}
        <div className="mt-5 space-y-2">
          <button
            ref={payButton}
            type="button"
            onClick={() => simulate("captured")}
            disabled={pending !== null}
            className="hf-btn hf-btn-primary w-full py-3"
          >
            {pending === "captured" ? "Paying…" : `Pay ${formatPrice(session.amount)}`}
          </button>
          <button
            type="button"
            onClick={() => simulate("failed")}
            disabled={pending !== null}
            className="hf-btn hf-btn-outline w-full"
          >
            {pending === "failed" ? "Declining…" : "Make the payment fail"}
          </button>
          <button
            type="button"
            onClick={() => onDone({ kind: "closed" })}
            disabled={pending !== null}
            className="w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
          >
            Close without paying
          </button>
        </div>
      </div>
    </div>
  );
}
