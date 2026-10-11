"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/client-api";
import { Field, FormError, SubmitButton } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setFormError(null);
    setFields({});

    const form = new FormData(event.currentTarget);
    const result = await apiRequest("/api/auth/login", {
      body: {
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      },
    });

    if (!result.ok) {
      setPending(false);
      setFormError(result.error);
      if (result.fields) setFields(result.fields);
      return;
    }

    toast("Signed in successfully", "success");
    // refresh() re-renders server components so the header picks up the new
    // session before the navigation lands.
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={formError} />

      <Field label="Email address" error={fields.email} required>
        {(props) => (
          <input
            {...props}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="you@example.com"
            className="hf-input"
          />
        )}
      </Field>

      <Field label="Password" error={fields.password} required>
        {(props) => (
          <div className="relative">
            <input
              {...props}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              maxLength={128}
              placeholder="••••••••••"
              className="hf-input pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-indigo-ink-600 hover:bg-cotton-100"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        )}
      </Field>

      <SubmitButton pending={pending} pendingLabel="Signing in…">
        Sign in
      </SubmitButton>

      <p className="text-center text-xs text-slate-500">
        By signing in you agree to our{" "}
        <Link href="/terms" className="hf-link">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy-policy" className="hf-link">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}
