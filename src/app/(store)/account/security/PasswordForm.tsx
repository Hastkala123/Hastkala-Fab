"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { Field, FormError, SubmitButton } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

function checks(value: string) {
  return [
    { label: "At least 10 characters", pass: value.length >= 10 },
    { label: "One lowercase letter", pass: /[a-z]/.test(value) },
    { label: "One uppercase letter", pass: /[A-Z]/.test(value) },
    { label: "One number", pass: /\d/.test(value) },
  ];
}

export default function PasswordForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [newPassword, setNewPassword] = useState("");

  const rules = checks(newPassword);
  const allPass = rules.every((r) => r.pass);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setFormError(null);
    setFields({});

    const form = event.currentTarget;
    const data = new FormData(form);

    const result = await apiRequest<{ message: string }>("/api/account/password", {
      body: {
        currentPassword: String(data.get("currentPassword") ?? ""),
        newPassword: String(data.get("newPassword") ?? ""),
        confirmPassword: String(data.get("confirmPassword") ?? ""),
      },
    });

    setPending(false);

    if (!result.ok) {
      setFormError(result.error);
      if (result.fields) setFields(result.fields);
      return;
    }

    form.reset();
    setNewPassword("");
    toast(result.data.message, "success");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={formError} />

      <Field label="Current password" error={fields.currentPassword} required>
        {(props) => (
          <input
            {...props}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            className="hf-input"
          />
        )}
      </Field>

      <Field label="New password" error={fields.newPassword} required>
        {(props) => (
          <input
            {...props}
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            maxLength={128}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="hf-input"
          />
        )}
      </Field>

      {newPassword.length > 0 && (
        <ul className="-mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          {rules.map((rule) => (
            <li
              key={rule.label}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                rule.pass ? "text-emerald-700" : "text-slate-500",
              )}
            >
              <span aria-hidden="true">{rule.pass ? "✓" : "○"}</span>
              {rule.label}
            </li>
          ))}
        </ul>
      )}

      <Field label="Confirm new password" error={fields.confirmPassword} required>
        {(props) => (
          <input
            {...props}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            maxLength={128}
            className="hf-input"
          />
        )}
      </Field>

      <SubmitButton
        pending={pending}
        disabled={!allPass}
        pendingLabel="Updating…"
        className="sm:w-auto sm:px-8"
      >
        Update password
      </SubmitButton>
    </form>
  );
}
