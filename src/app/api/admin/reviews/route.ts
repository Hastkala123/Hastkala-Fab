import { z } from "zod";
import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { cuidSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * PATCH — approve or reject a pending review.
 *
 * Approving recomputes the product's cached rating from the approved set, so
 * ratingAvg/ratingCount never drift from the reviews actually on display.
 */
export const PATCH = handler(async (request) => {
  const gate = await guard({
    auth: "admin",
    csrf: true,
    limit: { bucket: "admin-review", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const admin = gate.ctx.user!;

  const parsed = await parseJson(
    request,
    z.object({
      reviewId: cuidSchema,
      action: z.enum(["approve", "reject"]),
    }),
  );
  if (!parsed.ok) return parsed.response;

  const review = await db.review.findUnique({
    where: { id: parsed.data.reviewId },
    select: { id: true, productId: true },
  });
  if (!review) return fail("Review not found.", 404);

  if (parsed.data.action === "reject") {
    await db.review.delete({ where: { id: review.id } });
  } else {
    await db.review.update({
      where: { id: review.id },
      data: { isApproved: true },
    });
  }

  const stats = await db.review.aggregate({
    where: { productId: review.productId, isApproved: true },
    _avg: { rating: true },
    _count: { id: true },
  });

  await db.product.update({
    where: { id: review.productId },
    data: {
      ratingAvg: Math.round((stats._avg.rating ?? 0) * 10) / 10,
      ratingCount: stats._count.id,
    },
  });

  await audit({
    userId: admin.id,
    actorEmail: admin.email,
    action: `review.${parsed.data.action}`,
    entity: "Review",
    entityId: review.id,
  });

  return ok({ success: true });
});
