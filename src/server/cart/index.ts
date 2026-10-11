import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isProd } from "@/lib/env";
import { CART_COOKIE, getCurrentUser, sha256, type SessionUser } from "@/lib/auth";
import { liveProductWhere } from "@/server/catalog/products";
import { viewerFor } from "@/server/catalog/viewer";
import { UserError } from "@/server/errors";
import { priceItems, type Pricing } from "@/server/orders/pricing";
import { getSettings } from "@/server/settings";
import type { CartDisplay } from "@/lib/cart-types";

/**
 * Bags. A visitor can fill one before signing in: guest bags are found by a
 * random cookie whose SHA-256 is stored (a database leak does not reveal live
 * cookies). On sign-in the guest bag is folded into the account's bag.
 */

const GUEST_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const MAX_LINES = 50;
const COOKIE_DAYS = 30;

async function guestToken(): Promise<string | null> {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  return value && GUEST_TOKEN.test(value) ? value : null;
}

/** The current visitor's bag, or null if they have none yet. */
async function findCart(user: SessionUser | null) {
  if (user) return db.cart.findUnique({ where: { userId: user.id } });
  const token = await guestToken();
  return token ? db.cart.findUnique({ where: { guestTokenHash: sha256(token) } }) : null;
}

/** Read-or-create. Route handlers only — server components can't set cookies. */
async function ensureCart(user: SessionUser | null) {
  if (user) {
    return db.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
  }
  const existing = await findCart(null);
  if (existing) return existing;
  const token = randomBytes(32).toString("base64url");
  const cart = await db.cart.create({ data: { guestTokenHash: sha256(token) } });
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * COOKIE_DAYS,
  });
  return cart;
}

export async function getCartCount(): Promise<number> {
  const cart = await findCart(await getCurrentUser());
  if (!cart) return 0;
  const sum = await db.cartItem.aggregate({
    where: { cartId: cart.id, savedForLater: false },
    _sum: { quantity: true },
  });
  return sum._sum.quantity ?? 0;
}

/** GST is CGST+SGST inside the store's state; the bag guesses from the default address. */
async function guessIntraState(user: SessionUser | null, storeStateCode: string): Promise<boolean> {
  if (!user) return true;
  const address = await db.address.findFirst({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: { stateCode: true },
  });
  return !address || address.stateCode === storeStateCode;
}

export type CartView = Pricing & {
  cartId: string | null;
  couponCode: string | null;
  giftWrap: boolean;
  giftMessage: string | null;
  itemCount: number;
  /** Cart item ids, aligned with `lines`. */
  itemIds: string[];
};

const EMPTY_TOTALS = {
  pricesIncludeTax: true,
  lines: [],
  fees: [],
  itemsSubtotal: 0,
  discountTotal: 0,
  shippingFee: 0,
  codFee: 0,
  giftWrapFee: 0,
  taxableValue: 0,
  cgstTotal: 0,
  sgstTotal: 0,
  igstTotal: 0,
  roundOff: 0,
  grandTotal: 0,
  coupon: null,
  couponError: null,
  cod: { available: true, reason: null },
  blockingIssues: [],
} satisfies Pricing["quote"];

/** The bag with every price recomputed from the database. */
export async function getCartView(
  options: { paymentMethod?: "ONLINE" | "COD"; intraState?: boolean } = {},
): Promise<CartView> {
  const user = await getCurrentUser();
  const [cart, settings, viewer] = await Promise.all([findCart(user), getSettings(), viewerFor(user)]);
  const items = cart
    ? await db.cartItem.findMany({
        where: { cartId: cart.id, savedForLater: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, variantId: true, quantity: true },
      })
    : [];

  if (!cart || items.length === 0) {
    return {
      cartId: cart?.id ?? null,
      quote: EMPTY_TOTALS,
      lines: [],
      itemIds: [],
      customerType: viewer.wholesale ? "WHOLESALE" : "RETAIL",
      couponError: null,
      issues: [],
      couponCode: cart?.couponCode ?? null,
      giftWrap: cart?.giftWrap ?? false,
      giftMessage: cart?.giftMessage ?? null,
      itemCount: 0,
    };
  }

  const intraState =
    options.intraState ?? (await guessIntraState(user, settings["store.profile"].stateCode));
  const pricing = await priceItems(
    db,
    items.map((i) => ({ key: i.id, variantId: i.variantId, quantity: i.quantity })),
    { userId: user?.id ?? null, viewer },
    {
      couponCode: cart.couponCode,
      intraState,
      paymentMethod: options.paymentMethod ?? "ONLINE",
      giftWrap: cart.giftWrap,
      settings,
    },
  );

  return {
    ...pricing,
    cartId: cart.id,
    itemIds: pricing.lines.map((l) => l.key),
    couponCode: cart.couponCode,
    giftWrap: cart.giftWrap,
    giftMessage: cart.giftMessage,
    itemCount: pricing.lines.reduce((sum, l) => sum + l.quantity, 0),
  };
}

async function lineLimit(user: SessionUser | null): Promise<number> {
  const [settings, viewer] = await Promise.all([getSettings(), viewerFor(user)]);
  return viewer.wholesale ? settings.wholesale.maxQuantityPerLine : settings.checkout.maxQuantityPerLine;
}

async function sellableVariant(variantId: string) {
  const variant = await db.productVariant.findFirst({
    where: { id: variantId, isActive: true, archivedAt: null, product: liveProductWhere() },
    select: { id: true, stock: true, product: { select: { title: true } } },
  });
  if (!variant) throw new UserError("This item is no longer available.", 404);
  return variant;
}

export async function addToCart(variantId: string, quantity: number): Promise<void> {
  const user = await getCurrentUser();
  const variant = await sellableVariant(variantId);
  if (variant.stock <= 0) throw new UserError("Sorry, this is sold out.", 409);

  const cart = await ensureCart(user);
  const limit = await lineLimit(user);
  const existing = await db.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    select: { quantity: true, savedForLater: true },
  });
  if (!existing) {
    const lines = await db.cartItem.count({ where: { cartId: cart.id } });
    if (lines >= MAX_LINES) throw new UserError(`Your bag can hold up to ${MAX_LINES} different items.`);
  }

  const already = existing && !existing.savedForLater ? existing.quantity : 0;
  const wanted = already + quantity;
  if (wanted > limit) throw new UserError(`You can order up to ${limit} of this item at a time.`);
  if (wanted > variant.stock) {
    throw new UserError(
      already > 0
        ? `Only ${variant.stock} in stock and ${already} already in your bag.`
        : `Only ${variant.stock} in stock.`,
      409,
    );
  }

  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    create: { cartId: cart.id, variantId, quantity: wanted },
    update: { quantity: wanted, savedForLater: false },
  });
  await db.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
}

async function ownedItem(itemId: string) {
  const user = await getCurrentUser();
  const cart = await findCart(user);
  const item = cart
    ? await db.cartItem.findFirst({ where: { id: itemId, cartId: cart.id }, select: { id: true, variantId: true } })
    : null;
  if (!item) throw new UserError("That item is no longer in your bag.", 404);
  return { user, item };
}

export async function setCartQuantity(itemId: string, quantity: number): Promise<void> {
  const { user, item } = await ownedItem(itemId);
  if (quantity <= 0) {
    await db.cartItem.delete({ where: { id: item.id } });
    return;
  }
  const limit = await lineLimit(user);
  if (quantity > limit) throw new UserError(`You can order up to ${limit} of this item at a time.`);
  const variant = await db.productVariant.findUnique({ where: { id: item.variantId }, select: { stock: true } });
  if (!variant || quantity > variant.stock) {
    throw new UserError(`Only ${variant?.stock ?? 0} in stock.`, 409);
  }
  await db.cartItem.update({ where: { id: item.id }, data: { quantity } });
}

export async function removeCartItem(itemId: string): Promise<void> {
  const { item } = await ownedItem(itemId);
  await db.cartItem.delete({ where: { id: item.id } });
}

/** Checks the code against the bag as it is now, then remembers it. */
export async function applyCoupon(code: string | null): Promise<CartView> {
  const user = await getCurrentUser();
  const cart = await findCart(user);
  if (!cart) throw new UserError("Your bag is empty.");
  if (code === null) {
    await db.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    return getCartView();
  }
  if (!user) throw new UserError("Please sign in to use a coupon.", 401);

  const normalised = code.trim().toUpperCase();
  await db.cart.update({ where: { id: cart.id }, data: { couponCode: normalised } });
  const view = await getCartView();
  if (view.couponError) {
    await db.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    throw new UserError(view.couponError, 422);
  }
  return view;
}

export async function setGiftWrap(giftWrap: boolean, giftMessage: string | null): Promise<void> {
  const settings = await getSettings();
  if (giftWrap && !settings.checkout.giftWrapEnabled) throw new UserError("Gift wrap isn't available right now.");
  const cart = await ensureCart(await getCurrentUser());
  await db.cart.update({
    where: { id: cart.id },
    data: { giftWrap, giftMessage: giftWrap ? giftMessage : null },
  });
}

/**
 * Folds a guest bag into the account's bag at sign-in, so nothing is lost at
 * the moment we ask the shopper to log in. Quantities add up, capped at stock.
 */
export async function mergeGuestCart(userId: string): Promise<void> {
  const token = await guestToken();
  if (!token) return;
  const store = await cookies();
  const guest = await db.cart.findUnique({
    where: { guestTokenHash: sha256(token) },
    include: { items: { include: { variant: { select: { stock: true } } } } },
  });
  store.set(CART_COOKIE, "", { path: "/", maxAge: 0 });
  if (!guest) return;

  await db.$transaction(async (tx) => {
    const target = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {} });
    for (const item of guest.items) {
      const existing = await tx.cartItem.findUnique({
        where: { cartId_variantId: { cartId: target.id, variantId: item.variantId } },
      });
      const quantity = Math.min((existing?.quantity ?? 0) + item.quantity, Math.max(1, item.variant.stock));
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: target.id, variantId: item.variantId } },
        create: { cartId: target.id, variantId: item.variantId, quantity, savedForLater: item.savedForLater },
        update: { quantity },
      });
    }
    if (!target.couponCode && guest.couponCode) {
      await tx.cart.update({ where: { id: target.id }, data: { couponCode: guest.couponCode } });
    }
    await tx.cart.delete({ where: { id: guest.id } });
  }).catch((error) => {
    // A concurrent merge already moved the bag; nothing more to do.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
  });
}

/** Plain, serialisable bag for client components. */
export async function toCartDisplay(view: CartView): Promise<CartDisplay> {
  const settings = await getSettings();
  const { quote } = view;
  const linesTotal = quote.lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const threshold = settings.shipping.freeShippingThreshold;
  return {
    itemCount: view.itemCount,
    customerType: view.customerType,
    pricesIncludeTax: quote.pricesIncludeTax,
    lines: view.lines.map((line) => ({
      id: line.key,
      slug: line.productSlug,
      title: line.title,
      variantLabel: line.variantLabel,
      sku: line.sku,
      imageUrl: line.imageUrl,
      imageAlt: line.imageAlt,
      quantity: line.quantity,
      maxQuantity: Math.max(
        line.quantity,
        Math.min(
          line.stock,
          view.customerType === "WHOLESALE" ? settings.wholesale.maxQuantityPerLine : settings.checkout.maxQuantityPerLine,
        ),
      ),
      unitPrice: line.quote.unitPrice,
      mrp: line.mrp,
      lineSubtotal: line.quote.lineSubtotal,
      discount: line.quote.discountAllocated,
      lineTotal: line.quote.lineTotal,
      priceSource: line.quote.priceSource,
      note: line.quote.note,
      issue: line.issue,
    })),
    itemsSubtotal: quote.itemsSubtotal,
    discountTotal: quote.discountTotal,
    shippingFee: quote.shippingFee,
    codFee: quote.codFee,
    giftWrapFee: quote.giftWrapFee,
    taxTotal: quote.cgstTotal + quote.sgstTotal + quote.igstTotal,
    roundOff: quote.roundOff,
    grandTotal: quote.grandTotal,
    couponCode: view.couponCode,
    couponError: view.couponCode ? view.couponError : null,
    freeShipping:
      view.customerType === "RETAIL" && threshold != null && !quote.coupon?.freeShipping
        ? { threshold, remaining: Math.max(0, threshold - linesTotal) }
        : null,
    cod: quote.cod,
    issues: view.issues,
  };
}
