"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/money";
import { useFinishPayment, usePayment } from "./usePayment";

/** Seconds until `iso`, updated every second (null until mounted, to match the server render). */
function useSecondsLeft(iso: string): number | null {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setSeconds(Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [iso]);
  return seconds;
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** "Pay now" for an order awaiting payment, with the time left on the stock hold. */
export default function PayNowButton({
  orderNumber,
  amount,
  dueBy,
  from = "order",
}: {
  orderNumber: string;
  amount: number;
  dueBy: string;
  from?: "checkout" | "order";
}) {
  const { pay, busy, dialog } = usePayment();
  const finish = useFinishPayment(from);
  const secondsLeft = useSecondsLeft(dueBy);
  const expired = secondsLeft !== null && secondsLeft < 30;

  if (expired) {
    return (
      <p className="rounded-lg bg-madder-50 px-4 py-3 text-sm text-madder-800">
        The time to pay has run out, so these items are being released. Please place the order again.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 sm:items-start">
      <button
        type="button"
        onClick={async () => finish(orderNumber, await pay(orderNumber))}
        disabled={busy}
        className="hf-btn hf-btn-accent px-6 py-3"
      >
        {busy ? "Opening payment…" : `Pay ${formatPrice(amount)} now`}
      </button>
      {secondsLeft !== null && (
        <p className="text-xs text-slate-500" aria-live="off">
          Items held for you for another <span className="font-semibold tabular-nums">{clock(secondsLeft)}</span>
        </p>
      )}
      {dialog}
    </div>
  );
}
