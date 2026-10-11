"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/client-api";
import { Field, FormError, SubmitButton } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

/** Live feedback on the same rules the server enforces in passwordSchema. */
function passwordChecks(value: string) {
  return [
    { label: "At least 10 characters", pass: value.length >= 10 },
    { label: "One lowercase letter", pass: /[a-z]/.test(value) },
    { label: "One uppercase letter", pass: /[A-Z]/.test(value) },
    { label: "One number", pass: /\d/.test(value) },
  ];
}

export default function SignupForm({ defaultWholesale }: { defaultWholesale: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [accountType, setAccountType] = useState<"RETAIL" | "WHOLESALE">(
    defaultWholesale ? "WHOLESALE" : "RETAIL",
  );
  const [password, setPassword] = useState("");

  const checks = passwordChecks(password);
  const allPass = checks.every((c) => c.pass);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setFormError(null);
    setFields({});

    const form = new FormData(event.currentTarget);

    const result = await apiRequest<{ requiresApproval: boolean }>("/api/auth/signup", {
      body: {
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        password: String(form.get("password") ?? ""),
        confirmPassword: String(form.get("confirmPassword") ?? ""),
        accountType,
        businessName: String(form.get("businessName") ?? ""),
        gstin: String(form.get("gstin") ?? ""),
        acceptTerms: form.get("acceptTerms") === "on",
        marketingOptIn: form.get("marketingOptIn") === "on",
      },
    });

    if (!result.ok) {
      setPending(false);
      setFormError(result.error);
      if (result.fields) setFields(result.fields);
      return;
    }

    toast(
      result.data.requiresApproval
        ? "Account created. Our team will verify your business within one working day."
        : "Welcome to Hastkala Fab!",
      "success",
    );
    router.replace("/account");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={formError} />

      <fieldset>
        <legend className="hf-label">Account type</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(
            [
              { value: "RETAIL", title: "Personal", detail: "Shop for yourself" },
              { value: "WHOLESALE", title: "Wholesale", detail: "Trade pricing" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setAccountType(option.value)}
              aria-pressed={accountType === option.value}
              className={cn(
                "rounded-lg border-2 px-3 py-2.5 text-left transition",
                accountType === option.value
                  ? "border-indigo-ink-700 bg-indigo-ink-50"
                  : "border-cotton-300 hover:border-cotton-400",
              )}
            >
              <span className="block text-sm font-semibold text-indigo-ink-900">
                {option.title}
              </span>
              <span className="block text-xs text-slate-500">{option.detail}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Full name" error={fields.name} required>
        {(props) => (
          <input
            {...props}
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={80}
            placeholder="Priya Sharma"
            className="hf-input"
          />
        )}
      </Field>

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

      <Field
        label="Mobile number"
        error={fields.phone}
        hint="Optional, but we use it for delivery updates."
      >
        {(props) => (
          <input
            {...props}
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={14}
            placeholder="9876543210"
            className="hf-input"
          />
        )}
      </Field>

      {accountType === "WHOLESALE" && (
        <div className="space-y-5 rounded-lg border border-madder-200 bg-madder-50/50 p-4">
          <p className="text-xs font-medium text-madder-800">
            Wholesale accounts are verified by our team within one working day.
            Trade pricing appears automatically once approved.
          </p>

          <Field label="Business name" error={fields.businessName} required>
            {(props) => (
              <input
                {...props}
                name="businessName"
                type="text"
                required
                maxLength={120}
                placeholder="Meera Textiles & Handloom"
                className="hf-input"
              />
            )}
          </Field>

          <Field label="GSTIN" error={fields.gstin} hint="15-character GST identification number.">
            {(props) => (
              <input
                {...props}
                name="gstin"
                type="text"
                maxLength={15}
                placeholder="08AABCU9603R1ZM"
                className="hf-input uppercase"
              />
            )}
          </Field>
        </div>
      )}

      <Field label="Password" error={fields.password} required>
        {(props) => (
          <input
            {...props}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            className="hf-input"
          />
        )}
      </Field>

      {password.length > 0 && (
        <ul className="-mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          {checks.map((check) => (
            <li
              key={check.label}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                check.pass ? "text-emerald-700" : "text-slate-500",
              )}
            >
              <span aria-hidden="true">{check.pass ? "✓" : "○"}</span>
              {check.label}
            </li>
          ))}
        </ul>
      )}

      <Field label="Confirm password" error={fields.confirmPassword} required>
        {(props) => (
          <input
            {...props}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            maxLength={128}
            placeholder="••••••••••"
            className="hf-input"
          />
        )}
      </Field>

      <div>
        <label className="flex items-start gap-2.5 text-sm text-slate-600">
          <input
            name="acceptTerms"
            type="checkbox"
            required
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-cotton-400 accent-indigo-ink-800"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="hf-link font-medium">
              Terms &amp; Conditions
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" className="hf-link font-medium">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {fields.acceptTerms && (
          <p role="alert" className="mt-1 text-xs font-medium text-madder-600">
            {fields.acceptTerms}
          </p>
        )}
        <label className="mt-3 flex items-start gap-2.5 text-sm text-slate-600">
          <input
            name="marketingOptIn"
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-cotton-400 accent-indigo-ink-800"
          />
          <span>Email me about new prints and offers (optional — you can stop any time).</span>
        </label>
      </div>

      <SubmitButton
        pending={pending}
        disabled={!allPass}
        pendingLabel="Creating account…"
      >
        Create account
      </SubmitButton>
    </form>
  );
}
