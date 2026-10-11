"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Form field wrapper that keeps label, control, hint and error message wired
 * together with the right ARIA attributes. Every form in the app uses this so
 * error announcement and focus behaviour stay consistent.
 */
export function Field({
  label,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <label htmlFor={id} className="hf-label">
        {label}
        {required && (
          <span className="ml-0.5 text-madder-600" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy || undefined,
      })}

      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-madder-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** Non-field-specific error banner shown at the top of a form. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-madder-200 bg-madder-50 px-4 py-3 text-sm font-medium text-madder-800",
      )}
    >
      {message}
    </div>
  );
}

export function SubmitButton({
  pending,
  disabled,
  children,
  pendingLabel = "Please wait…",
  className,
}: {
  pending: boolean;
  /** Blocks submission without implying a request is in flight. */
  disabled?: boolean;
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn("hf-btn hf-btn-primary w-full py-2.5", className)}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
