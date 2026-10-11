import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import ReviewModeration from "./ReviewModeration";

export const metadata: Metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const showApproved = params.filter === "approved";

  const [reviews, pendingCount, approvedCount] = await Promise.all([
    db.review.findMany({
      where: { isApproved: showApproved },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { title: true, slug: true } },
      },
    }),
    db.review.count({ where: { isApproved: false } }),
    db.review.count({ where: { isApproved: true } }),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
        Reviews
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Customer reviews are held until approved, so nothing unvetted reaches the
        storefront.
      </p>

      <nav aria-label="Filter reviews" className="mt-5 flex gap-1.5">
        <Link
          href="/admin/reviews"
          className={
            !showApproved
              ? "hf-btn hf-btn-primary py-1.5 text-sm"
              : "hf-btn hf-btn-outline py-1.5 text-sm"
          }
        >
          Pending ({pendingCount})
        </Link>
        <Link
          href="/admin/reviews?filter=approved"
          className={
            showApproved
              ? "hf-btn hf-btn-primary py-1.5 text-sm"
              : "hf-btn hf-btn-outline py-1.5 text-sm"
          }
        >
          Published ({approvedCount})
        </Link>
      </nav>

      {reviews.length === 0 ? (
        <div className="hf-card mt-6 p-12 text-center">
          <p className="text-sm text-slate-500">
            {showApproved
              ? "No published reviews yet."
              : "Nothing waiting for moderation. "}
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="hf-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-turmeric-600">
                      {"★".repeat(review.rating)}
                      <span className="text-cotton-400">
                        {"★".repeat(5 - review.rating)}
                      </span>
                    </span>
                    {review.isVerifiedPurchase && (
                      <span className="hf-badge text-emerald-700">
                        Verified purchase
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/product/${review.product.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 block text-xs text-indigo-ink-700 hover:underline"
                  >
                    {review.product.title} ↗
                  </Link>
                </div>

                <ReviewModeration reviewId={review.id} isApproved={review.isApproved} />
              </div>

              {review.title && (
                <h2 className="mt-3 text-sm font-bold text-indigo-ink-900">
                  {review.title}
                </h2>
              )}
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {review.comment}
              </p>

              <p className="mt-3 text-xs text-slate-400">
                {review.user.name} ({review.user.email}) ·{" "}
                {formatDate(review.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
