import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { CART_COOKIE, canSeeWholesalePricing, getCurrentUser, type SessionUser } from "./auth";
import { computeDiscount, shippingFeeFor, taxFor } from "./money";
import { isProd } from "./env";

/**
 * Cart resolution.
 *
 * A visitor can build a cart before signing in. Anonymous carts key off an
 * opaque random cookie id; on login `mergeGuestCart` folds them into the user's
 * cart so nothing is lost at the exact moment we ask them to authenticate —
 * that hand-off is where most stores leak conversions.
 */

export async function getCartSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

/** Read-or-create. Only call from a route handler or server action — server
 *  components are not allowed to set cookies. */
export async function ensureCartSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(CART_COOKIE)?.value;
  if (existing && /^[a-f0-9]{32}$/.test(existing)) return existing;

  const id = randomBytes(16).toString("hex");
  store.set(CART_COOKIE, id, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return id;
}

/** The Prisma `where` that scopes cart rows to exactly this visitor. */
export async function cartScope(): Promise<
  { userId: string } | { sessionId: string } | null
> {
  const user = await getCurrentUser();
  if (user) return { userId: user.id };
  const sessionId = await getCartSessionId();
  return sessionId ? { sessionId } : null;
}

export async function getCartCount(): Promise<number> {
  const scope = await cartScope();
  if (!scope) return 0;
  const result = await db.cartItem.aggregate({
    where: scope,
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

export type CartLine = {
  id: string;
  productId: string;
  variantId: string | null;
  title: string;
  slug: string;
  sku: string;
  image: string | null;
  variantLabel: string | null;
  unitPrice: number;
  mrp: number;
  quantity: number;
  lineTotal: number;
  availableStock: number;
  isActive: boolean;
};

export type CartSummary = {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  discount: number;
  shippingFee: number;
  tax: number;
  total: number;
  orderType: "RETAIL" | "WHOLESALE";
  couponCode: string | null;
  /** Human-readable problems that must be resolved before checkout. */
  issues: string[];
};

/**
 * Builds the authoritative cart total.
 *
 * Prices are always re-read from the database here — never trusted from the
 * client. A cart line only carries ids and a quantity; every rupee is computed
 * server-side, so tampering with a request body cannot change what is charged.
 */
export async function getCart(couponCode?: string | null): Promise<CartSummary> {
  const scope = await cartScope();
  const user = await getCurrentUser();
  const wholesale = canSeeWholesalePricing(user) && user?.role === "WHOLESALE";
  const orderType: "RETAIL" | "WHOLESALE" = wholesale ? "WHOLESALE" : "RETAIL";

  const empty: CartSummary = {
    lines: [],
    itemCount: 0,
    subtotal: 0,
    discount: 0,
    shippingFee: 0,
    tax: 0,
    total: 0,
    orderType,
    couponCode: null,
    issues: [],
  };

  if (!scope) return empty;

  const items = await db.cartItem.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        include: { images: { orderBy: { position: "asc" }, take: 1 } },
      },
      variant: true,
    },
  });

  if (items.length === 0) return empty;

  const issues: string[] = [];

  const lines: CartLine[] = items.map((item) => {
    const base =
      wholesale && item.product.priceWholesale != null
        ? item.product.priceWholesale
        : item.product.priceRetail;

    const unitPrice = Math.max(0, base + (item.variant?.priceDelta ?? 0));
    const availableStock = item.variant ? item.variant.stock : item.product.stock;

    if (!item.product.isActive) {
      issues.push(`"${item.product.title}" is no longer available.`);
    } else if (availableStock <= 0) {
      issues.push(`"${item.product.title}" is out of stock.`);
    } else if (item.quantity > availableStock) {
      issues.push(
        `Only ${availableStock} left of "${item.product.title}" — reduce the quantity.`,
      );
    }

    if (
      wholesale &&
      item.product.priceWholesale != null &&
      item.quantity < item.product.wholesaleMinQty
    ) {
      issues.push(
        `Wholesale orders for "${item.product.title}" need at least ${item.product.wholesaleMinQty} units.`,
      );
    }

    const variantLabel = [item.variant?.size, item.variant?.color]
      .filter(Boolean)
      .join(" / ");

    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      title: item.product.title,
      slug: item.product.slug,
      sku: item.variant?.sku ?? item.product.sku,
      image: item.product.images[0]?.url ?? null,
      variantLabel: variantLabel || null,
      unitPrice,
      mrp: item.product.mrp,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
      availableStock,
      isActive: item.product.isActive,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  let discount = 0;
  let appliedCoupon: string | null = null;

  if (couponCode) {
    const coupon = await db.coupon.findUnique({
      where: { code: couponCode.toUpperCase() },
    });
    if (coupon && isCouponUsable(coupon, subtotal, orderType).ok) {
      discount = computeDiscount(coupon, subtotal);
      appliedCoupon = coupon.code;
    }
  }

  const discountedSubtotal = subtotal - discount;
  const shippingFee = shippingFeeFor(discountedSubtotal, orderType);
  const tax = taxFor(lines);
  const total = discountedSubtotal + shippingFee + tax;

  return {
    lines,
    itemCount,
    subtotal,
    discount,
    shippingFee,
    tax,
    total,
    orderType,
    couponCode: appliedCoupon,
    issues: [...new Set(issues)],
  };
}

type CouponRecord = {
  isActive: boolean;
  startsAt: Date;
  expiresAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  minOrderValue: number;
  appliesTo: string;
};

/** Central coupon eligibility check, shared by preview and checkout. */
export function isCouponUsable(
  coupon: CouponRecord,
  subtotal: number,
  orderType: string,
): { ok: true } | { ok: false; reason: string } {
  const now = new Date();
  if (!coupon.isActive) return { ok: false, reason: "This coupon is no longer active." };
  if (coupon.startsAt > now) return { ok: false, reason: "This coupon is not active yet." };
  if (coupon.expiresAt && coupon.expiresAt < now) {
    return { ok: false, reason: "This coupon has expired." };
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: "This coupon has reached its usage limit." };
  }
  if (subtotal < coupon.minOrderValue) {
    return {
      ok: false,
      reason: `Add ₹${Math.ceil((coupon.minOrderValue - subtotal) / 100)} more to use this coupon.`,
    };
  }
  if (coupon.appliesTo !== "ALL" && coupon.appliesTo !== orderType) {
    return { ok: false, reason: "This coupon does not apply to your account type." };
  }
  return { ok: true };
}

/**
 * Folds an anonymous cart into the user's cart at login. Quantities are summed
 * where the same product/variant exists in both, and clamped to available stock.
 */
export async function mergeGuestCart(user: SessionUser): Promise<void> {
  const sessionId = await getCartSessionId();
  if (!sessionId) return;

  const guestItems = await db.cartItem.findMany({
    where: { sessionId },
    include: { product: { select: { stock: true } }, variant: { select: { stock: true } } },
  });
  if (guestItems.length === 0) return;

  for (const item of guestItems) {
    const stock = item.variant ? item.variant.stock : item.product.stock;

    const existing = await db.cartItem.findFirst({
      where: {
        userId: user.id,
        productId: item.productId,
        variantId: item.variantId,
      },
    });

    if (existing) {
      await db.cartItem.update({
        where: { id: existing.id },
        data: { quantity: Math.min(existing.quantity + item.quantity, Math.max(1, stock)) },
      });
    } else {
      await db.cartItem
        .create({
          data: {
            userId: user.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: Math.min(item.quantity, Math.max(1, stock)),
          },
        })
        .catch(() => undefined); // Unique-constraint race: safe to skip.
    }
  }

  await db.cartItem.deleteMany({ where: { sessionId } });

  const store = await cookies();
  store.set(CART_COOKIE, "", { path: "/", maxAge: 0 });
}
