import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { reviewModerationSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** Approve or reject a review, then refresh the product's real average rating. */
export const PATCH = handler(async (request) => {
  const gate = await guard({ auth: "staff", permission: "reviews.manage", limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, reviewModerationSchema);
  if (!parsed.ok) return parsed.response;
  const { reviewId, status, rejectionReason } = parsed.data;

  const review = await db.review.findUnique({ where: { id: reviewId }, select: { id: true, productId: true, status: true } });
  if (!review) return fail("Review not found.", 404);

  await db.$transaction(async (tx) => {
    await tx.review.update({
      where: { id: review.id },
      data: { status, rejectionReason: status === "REJECTED" ? rejectionReason : null },
    });
    const stats = await tx.review.aggregate({
      where: { productId: review.productId, status: "APPROVED" },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.product.update({
      where: { id: review.productId },
      data: { ratingAvg: Math.round((stats._avg.rating ?? 0) * 10) / 10, ratingCount: stats._count._all },
    });
  });

  await audit({
    actor: gate.ctx.user,
    action: `review.${status.toLowerCase()}`,
    entityType: "Review",
    entityId: review.id,
    before: { status: review.status },
    after: { status, rejectionReason },
  });
  return ok({ success: true });
});
