"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";

export default function ReviewModeration({
  reviewId,
  isApproved,
}: {
  reviewId: string;
  isApproved: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function act(action: "approve" | "reject") {
    setPending(true);
    const result = await apiRequest("/api/admin/reviews", {
      method: "PATCH",
      body: { reviewId, action },
    });
    setPending(false);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }

    toast(action === "approve" ? "Review published" : "Review removed", "success");
    router.refresh();
  }

  return (
    <div className="flex shrink-0 gap-1.5">
      {!isApproved && (
        <button
          type="button"
          onClick={() => act("approve")}
          disabled={pending}
          className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? "…" : "Approve"}
        </button>
      )}
      <button
        type="button"
        onClick={() => act("reject")}
        disabled={pending}
        className="rounded px-2.5 py-1 text-xs font-semibold text-madder-600 transition hover:bg-madder-50 disabled:opacity-50"
      >
        {isApproved ? "Unpublish & delete" : "Reject"}
      </button>
    </div>
  );
}
