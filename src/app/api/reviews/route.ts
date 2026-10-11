import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { reviewSchema } from "@/lib/validators";

export const runtime = "nodejs";

export const POST = handler(async (request) => {
  const gate = await guard({
    auth: "user",
    csrf: true,
    limit: { bucket: "review", ...RATE_LIMITS.review },
  });
  if (!gate.ok) return gate.response;

  const user = gate.ctx.user!;

  const parsed = await parseJson(request, reviewSchema);
  if (!parsed.ok) return parsed.response;

  const { productId, rating, title, comment } = parsed.data;

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) return fail("Product not found.", 404);

  const existing = await db.review.findUnique({
    where: { productId_userId: { productId, userId: user.id } },
    select: { id: true },
  });
  if (existing) {
    return fail("You have already reviewed this product. Edit your existing review instead.", 409);
  }

  // "Verified purchase" is asserted from order history, never from the client.
  const purchased = await db.orderItem.findFirst({
    where: {
      productId,
      order: { userId: user.id, status: "DELIVERED" },
    },
    select: { id: true },
  });

  await db.review.create({
    data: {
      productId,
      userId: user.id,
      rating,
      title: title || null,
      comment,
      isVerifiedPurchase: Boolean(purchased),
      // Held for moderation: unvetted user text must never reach the storefront.
      isApproved: false,
    },
  });

  return ok(
    {
      success: true,
      message: "Thank you. Your review will appear once our team has checked it.",
    },
    201,
  );
});
