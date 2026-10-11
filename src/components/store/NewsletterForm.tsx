"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

export default function NewsletterForm() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    const result = await apiRequest("/api/newsletter", { body: { email } });
    setPending(false);

    if (result.ok) {
      setDone(true);
      setEmail("");
      toast("You're on the list. Your 10% code is on its way.", "success");
    } else {
      toast(result.error, "error");
    }
  }

  if (done) {
    return (
      <p className="mt-3 rounded-lg bg-white/10 px-4 py-3 text-sm text-cotton-100">
        ✓ Subscribed. Check your inbox for the welcome code.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex gap-2">
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <input
        id="newsletter-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        maxLength={254}
        autoComplete="email"
        className="min-w-0 flex-1 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm text-cotton-50 placeholder:text-cotton-300/50 focus:border-turmeric-400 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-lg bg-turmeric-500 px-4 py-2.5 text-sm font-semibold text-indigo-ink-950 transition hover:bg-turmeric-400 disabled:opacity-60"
      >
        {pending ? "…" : "Join"}
      </button>
    </form>
  );
}
