"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { Field, FormError, SubmitButton } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

export default function ReviewForm({ productId }: { productId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (rating === 0) {
      setFormError("Please choose a star rating.");
      return;
    }

    setPending(true);
    setFormError(null);
    setFields({});

    const form = new FormData(event.currentTarget);
    const result = await apiRequest<{ message: string }>("/api/reviews", {
      body: {
        productId,
        rating,
        title: String(form.get("title") ?? ""),
        comment: String(form.get("comment") ?? ""),
      },
    });

    setPending(false);

    if (!result.ok) {
      setFormError(result.error);
      if (result.fields) setFields(result.fields);
      return;
    }

    setDone(true);
    toast(result.data.message, "success");
    router.refresh();
  }

  if (done) {
    return (
      <div className="rounded-card border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-medium text-emerald-800">
          Thank you. Your review has been submitted and will appear once our team
          has checked it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="hf-card max-w-xl space-y-5 p-5" noValidate>
      <h3 className="font-display text-base font-bold text-indigo-ink-950">
        Write a review
      </h3>

      <FormError message={formError} />

      <fieldset>
        <legend className="hf-label">Your rating</legend>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              aria-pressed={rating === value}
              className={cn(
                "text-2xl leading-none transition",
                value <= rating ? "text-turmeric-500" : "text-cotton-400 hover:text-turmeric-300",
              )}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Title" error={fields.title} hint="Optional — a short summary.">
        {(props) => (
          <input
            {...props}
            name="title"
            type="text"
            maxLength={100}
            placeholder="Beautiful print, true to the photos"
            className="hf-input"
          />
        )}
      </Field>

      <Field label="Your review" error={fields.comment} required>
        {(props) => (
          <textarea
            {...props}
            name="comment"
            rows={4}
            required
            minLength={10}
            maxLength={2000}
            placeholder="How is the fabric, the fit and the print quality?"
            className="hf-input resize-y"
          />
        )}
      </Field>

      <SubmitButton pending={pending} pendingLabel="Submitting…">
        Submit review
      </SubmitButton>
    </form>
  );
}
