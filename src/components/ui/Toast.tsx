"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastVariant = "success" | "error" | "info";
type Toast = { id: number; message: string; variant: ToastVariant };

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = nextId++;
    setToasts((current) => [...current, { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
        aria-live="polite" announces the toast to screen readers without
        interrupting whatever the user is currently doing.
      */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.variant === "error" ? "alert" : "status"}
            className={[
              "hf-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ring-1",
              t.variant === "success"
                ? "bg-emerald-600 text-white ring-emerald-700/30"
                : t.variant === "error"
                  ? "bg-madder-600 text-white ring-madder-800/30"
                  : "bg-indigo-ink-800 text-white ring-indigo-ink-950/30",
            ].join(" ")}
          >
            <span aria-hidden="true" className="mt-0.5 shrink-0">
              {t.variant === "success" ? "✓" : t.variant === "error" ? "!" : "i"}
            </span>
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => setToasts((c) => c.filter((x) => x.id !== t.id))}
              className="shrink-0 opacity-70 transition hover:opacity-100"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside a ToastProvider");
  return context;
}
