import { z } from "zod";
import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { cuidSchema } from "@/lib/validators";
import { liveProductWhere } from "@/server/catalog/products";

export const runtime = "nodejs";

const MAX_WISHLIST = 200;

/** Toggle a product in the signed-in shopper's wishlist. */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "wishlist", ...RATE_LIMITS.writeApi } });
  if (!gate.ok) return gate.response;
  const user = gate.ctx.user!;

  const parsed = await parseJson(request, z.object({ productId: cuidSchema }));
  if (!parsed.ok) return parsed.response;

  const existing = await db.wishlistItem.findUnique({
    where: { userId_productId: { userId: user.id, productId: parsed.data.productId } },
  });
  if (existing) {
    await db.wishlistItem.delete({ where: { id: existing.id } });
    return ok({ saved: false });
  }

  const product = await db.product.findFirst({
    where: { AND: [liveProductWhere(), { id: parsed.data.productId }] },
    select: { id: true },
  });
  if (!product) return fail("Product not found.", 404);
  if ((await db.wishlistItem.count({ where: { userId: user.id } })) >= MAX_WISHLIST) {
    return fail(`Your wishlist can hold up to ${MAX_WISHLIST} items.`, 409);
  }

  await db.wishlistItem.upsert({
    where: { userId_productId: { userId: user.id, productId: product.id } },
    create: { userId: user.id, productId: product.id },
    update: {},
  });
  return ok({ saved: true }, 201);
});
