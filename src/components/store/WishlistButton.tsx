"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

export default function WishlistButton({
  productId,
  initial = false,
  variant = "icon",
}: {
  productId: string;
  initial?: boolean;
  variant?: "icon" | "full";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();

  async function toggle(event: React.MouseEvent) {
    // The card is a stretched link; without this the click navigates instead.
    event.preventDefault();
    event.stopPropagation();

    // Optimistic flip, rolled back if the request fails.
    const next = !saved;
    setSaved(next);

    const result = await apiRequest<{ saved: boolean }>("/api/wishlist", {
      body: { productId },
    });

    if (!result.ok) {
      setSaved(!next);
      if (result.status === 401) {
        toast("Please sign in to save items to your wishlist.", "info");
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      } else {
        toast(result.error, "error");
      }
      return;
    }

    setSaved(result.data.saved);
    toast(result.data.saved ? "Saved to wishlist" : "Removed from wishlist", "success");
    startTransition(() => router.refresh());
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        className={cn(
          "hf-btn hf-btn-outline w-full",
          saved && "border-madder-400 bg-madder-50 text-madder-700",
        )}
      >
        <HeartIcon filled={saved} />
        {saved ? "Saved to wishlist" : "Add to wishlist"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={saved}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow-sm ring-1 ring-cotton-300 backdrop-blur transition hover:bg-white",
        saved ? "text-madder-600" : "text-indigo-ink-500",
      )}
    >
      <HeartIcon filled={saved} />
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20s-7.5-4.6-7.5-9.5a4.2 4.2 0 0 1 7.5-2.6 4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
    </svg>
  );
}
