import { z } from "zod";
import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { cuidSchema } from "@/lib/validators";

export const runtime = "nodejs";

/** POST — toggle a product in the signed-in user's wishlist. */
export const POST = handler(async (request) => {
  const gate = await guard({
    auth: "user",
    csrf: true,
    limit: { bucket: "wishlist", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const user = gate.ctx.user!;

  const parsed = await parseJson(request, z.object({ productId: cuidSchema }));
  if (!parsed.ok) return parsed.response;

  const product = await db.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, isActive: true },
  });
  if (!product || !product.isActive) return fail("Product not found.", 404);

  const existing = await db.wishlistItem.findUnique({
    where: { userId_productId: { userId: user.id, productId: product.id } },
  });

  if (existing) {
    await db.wishlistItem.delete({ where: { id: existing.id } });
    return ok({ saved: false });
  }

  await db.wishlistItem.create({
    data: { userId: user.id, productId: product.id },
  });
  return ok({ saved: true }, 201);
});
