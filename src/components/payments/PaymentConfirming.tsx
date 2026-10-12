"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";

const INTERVAL_MS = 4000;
const MAX_TRIES = 15;

/**
 * Shown when the gateway has the payment but hasn't confirmed it yet
 * (usually seconds). Checks every few seconds, then reloads the page.
 */
export default function PaymentConfirming({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let tries = 0;
    let stopped = false;
    const timer = window.setInterval(async () => {
      tries++;
      const result = await apiRequest<{ paid: boolean; status: string }>("/api/payments/status", { body: { orderNumber } });
      if (stopped) return;
      if (result.ok && (result.data.paid || !["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(result.data.status))) {
        stopped = true;
        window.clearInterval(timer);
        router.replace(window.location.pathname);
        router.refresh();
      } else if (tries >= MAX_TRIES) {
        stopped = true;
        window.clearInterval(timer);
        setGaveUp(true);
      }
    }, INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [orderNumber, router]);

  return (
    <p role="status" className="rounded-lg bg-indigo-ink-50 px-4 py-3 text-sm text-indigo-ink-900">
      {gaveUp
        ? "Your bank is taking longer than usual. We'll confirm the order as soon as the payment arrives — if it doesn't go through, any money taken is returned automatically."
        : "Confirming your payment with the bank… this page updates by itself."}
    </p>
  );
}
