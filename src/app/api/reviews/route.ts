import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { reviewSchema } from "@/lib/validators";
import { liveProductWhere } from "@/server/catalog/products";

export const runtime = "nodejs";

export const POST = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "review", ...RATE_LIMITS.review } });
  if (!gate.ok) return gate.response;
  const user = gate.ctx.user!;

  const parsed = await parseJson(request, reviewSchema);
  if (!parsed.ok) return parsed.response;
  const { productId, rating, title, body } = parsed.data;

  const product = await db.product.findFirst({
    where: { AND: [liveProductWhere(), { id: productId }] },
    select: { id: true },
  });
  if (!product) return fail("Product not found.", 404);

  const existing = await db.review.findUnique({
    where: { productId_userId: { productId, userId: user.id } },
    select: { id: true },
  });
  if (existing) return fail("You have already reviewed this product.", 409);

  // "Verified purchase" comes from order history, never from the request.
  const purchased = await db.orderItem.findFirst({
    where: { productId, order: { userId: user.id, status: "DELIVERED" } },
    select: { id: true },
  });

  await db.review.create({
    data: {
      productId,
      userId: user.id,
      orderItemId: purchased?.id ?? null,
      rating,
      title,
      body,
      isVerifiedPurchase: Boolean(purchased),
      // Held for moderation: shopper text never reaches the storefront unchecked.
      status: "PENDING",
    },
  });

  return ok({ success: true, message: "Thank you. Your review will appear once our team has checked it." }, 201);
});
