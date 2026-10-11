import { z } from "zod";
import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { cartScope, ensureCartSessionId, getCart } from "@/lib/cart";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { addToCartSchema, cuidSchema, updateCartSchema } from "@/lib/validators";

export const runtime = "nodejs";

/** GET — current cart totals. Read-only, so no CSRF token is required. */
export const GET = handler(async () => {
  const cart = await getCart();
  return ok({ itemCount: cart.itemCount, subtotal: cart.subtotal, total: cart.total });
});

/** POST — add an item. */
export const POST = handler(async (request) => {
  const gate = await guard({
    csrf: true,
    limit: { bucket: "cart-add", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const parsed = await parseJson(request, addToCartSchema);
  if (!parsed.ok) return parsed.response;

  const { productId, variantId, quantity } = parsed.data;

  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      stock: true,
      isActive: true,
      variants: { select: { id: true, stock: true } },
    },
  });

  if (!product || !product.isActive) {
    return fail("This product is no longer available.", 404);
  }

  // A product with variants must be added with one — otherwise stock is
  // decremented against the wrong pool at checkout.
  if (product.variants.length > 0 && !variantId) {
    return fail("Please choose a size or colour first.", 422);
  }

  let availableStock = product.stock;

  if (variantId) {
    const variant = product.variants.find((v) => v.id === variantId);
    // Verifying the variant belongs to THIS product blocks a crafted request
    // from attaching another product's cheaper variant.
    if (!variant) return fail("That option is not available for this product.", 422);
    availableStock = variant.stock;
  }

  if (availableStock <= 0) return fail("This item is out of stock.", 409);

  const scope = await cartScope();
  const user = await getCurrentUser();
  const where = scope ?? { sessionId: await ensureCartSessionId() };

  const existing = await db.cartItem.findFirst({
    where: { ...where, productId, variantId: variantId || null },
  });

  const desired = (existing?.quantity ?? 0) + quantity;
  if (desired > availableStock) {
    return fail(
      `Only ${availableStock} in stock. You already have ${existing?.quantity ?? 0} in your cart.`,
      409,
    );
  }

  if (existing) {
    await db.cartItem.update({
      where: { id: existing.id },
      data: { quantity: desired },
    });
  } else {
    await db.cartItem.create({
      data: {
        userId: user?.id ?? null,
        sessionId: user ? null : (where as { sessionId: string }).sessionId,
        productId,
        variantId: variantId || null,
        quantity,
      },
    });
  }

  const cart = await getCart();
  return ok({ itemCount: cart.itemCount, message: "Added to cart" }, 201);
});

/** PATCH — change a line quantity; 0 removes the line. */
export const PATCH = handler(async (request) => {
  const gate = await guard({
    csrf: true,
    limit: { bucket: "cart-update", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const parsed = await parseJson(request, updateCartSchema);
  if (!parsed.ok) return parsed.response;

  const { cartItemId, quantity } = parsed.data;
  const scope = await cartScope();
  if (!scope) return fail("Your cart is empty.", 404);

  // Scoping the lookup to the caller's cart is what prevents one visitor
  // editing another visitor's cart by guessing an id (IDOR).
  const item = await db.cartItem.findFirst({
    where: { id: cartItemId, ...scope },
    include: {
      product: { select: { stock: true, isActive: true } },
      variant: { select: { stock: true } },
    },
  });

  if (!item) return fail("That item is not in your cart.", 404);

  if (quantity === 0) {
    await db.cartItem.delete({ where: { id: item.id } });
  } else {
    const available = item.variant ? item.variant.stock : item.product.stock;
    if (quantity > available) {
      return fail(`Only ${available} available.`, 409);
    }
    await db.cartItem.update({ where: { id: item.id }, data: { quantity } });
  }

  const cart = await getCart();
  return ok({ itemCount: cart.itemCount, subtotal: cart.subtotal, total: cart.total });
});

/** DELETE — remove a single line, or the whole cart with `{ all: true }`. */
export const DELETE = handler(async (request) => {
  const gate = await guard({ csrf: true });
  if (!gate.ok) return gate.response;

  const parsed = await parseJson(
    request,
    z.object({ cartItemId: cuidSchema.optional(), all: z.boolean().optional() }),
  );
  if (!parsed.ok) return parsed.response;

  const scope = await cartScope();
  if (!scope) return ok({ itemCount: 0 });

  if (parsed.data.all) {
    await db.cartItem.deleteMany({ where: scope });
    return ok({ itemCount: 0 });
  }

  if (!parsed.data.cartItemId) return fail("Nothing specified to remove.", 422);

  await db.cartItem.deleteMany({ where: { id: parsed.data.cartItemId, ...scope } });

  const cart = await getCart();
  return ok({ itemCount: cart.itemCount });
});
