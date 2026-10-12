"use client";

import { Field } from "@/components/ui/Field";

/** A labelled text input for the wholesale forms. */
export default function TextInput({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  type = "text",
  autoComplete,
  maxLength = 200,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(props) => (
        <input
          {...props}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          maxLength={maxLength}
          placeholder={placeholder}
          required={required}
          className="hf-input"
        />
      )}
    </Field>
  );
}
