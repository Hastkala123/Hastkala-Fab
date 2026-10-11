import { z } from "zod";
import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { addToCartSchema, cuidSchema, updateCartSchema } from "@/lib/validators";
import { addToCart, getCartView, removeCartItem, setCartQuantity } from "@/server/cart";

export const runtime = "nodejs";

/** Totals for the header badge and mini-bag. Read-only, so no CSRF token. */
async function summary() {
  const view = await getCartView();
  return { itemCount: view.itemCount, total: view.quote.grandTotal };
}

export const GET = handler(async () => ok(await summary()));

/** Add a size/colour to the bag. Prices are never taken from the request. */
export const POST = handler(async (request) => {
  const gate = await guard({ limit: { bucket: "cart", ...RATE_LIMITS.writeApi } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, addToCartSchema);
  if (!parsed.ok) return parsed.response;

  await addToCart(parsed.data.variantId, parsed.data.quantity);
  return ok({ ...(await summary()), message: "Added to bag" }, 201);
});

/** Change a line's quantity; 0 removes it. */
export const PATCH = handler(async (request) => {
  const gate = await guard({ limit: { bucket: "cart", ...RATE_LIMITS.writeApi } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, updateCartSchema);
  if (!parsed.ok) return parsed.response;

  await setCartQuantity(parsed.data.itemId, parsed.data.quantity);
  return ok(await summary());
});

export const DELETE = handler(async (request) => {
  const gate = await guard({ limit: { bucket: "cart", ...RATE_LIMITS.writeApi } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, z.object({ itemId: cuidSchema }));
  if (!parsed.ok) return parsed.response;

  await removeCartItem(parsed.data.itemId);
  return ok(await summary());
});
