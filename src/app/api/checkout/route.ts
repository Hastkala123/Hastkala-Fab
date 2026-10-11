import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { getCart, isCouponUsable } from "@/lib/cart";
import { computeDiscount, shippingFeeFor, taxFor } from "@/lib/money";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { checkoutSchema } from "@/lib/validators";
import { generateOrderNumber } from "@/lib/utils";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** Thrown inside the checkout transaction when stock disappears mid-flight. */
class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}

/**
 * POST — place an order.
 *
 * Everything that determines the amount charged is recomputed here from the
 * database. The request body supplies only an address id, a payment method and
 * an optional coupon code; it can never supply a price, a quantity total or a
 * discount. That is the whole defence against cart-tampering fraud.
 *
 * The write is wrapped in a single transaction so a failure partway through
 * cannot leave stock decremented without an order, or an order without stock
 * reserved.
 */
export const POST = handler(async (request) => {
  const gate = await guard({
    auth: "user",
    csrf: true,
    limit: { bucket: "checkout", ...RATE_LIMITS.checkout },
  });
  if (!gate.ok) return gate.response;

  const user = gate.ctx.user!;

  const parsed = await parseJson(request, checkoutSchema);
  if (!parsed.ok) return parsed.response;

  const { addressId, paymentMethod, couponCode, customerNote } = parsed.data;

  // Scoping to userId stops a crafted request shipping to someone else's saved
  // address (and, worse, reading it back from the order record).
  const address = await db.address.findFirst({
    where: { id: addressId, userId: user.id },
  });
  if (!address) return fail("Select a valid delivery address.", 422);

  const cart = await getCart();
  if (cart.lines.length === 0) return fail("Your cart is empty.", 422);
  if (cart.issues.length > 0) {
    return fail(cart.issues[0]!, 409);
  }

  // Re-validate the coupon server-side rather than trusting the preview.
  let discount = 0;
  let appliedCoupon: string | null = null;

  if (couponCode) {
    const coupon = await db.coupon.findUnique({
      where: { code: couponCode.toUpperCase() },
    });
    if (!coupon) return fail("That coupon code is not valid.", 422);

    const usable = isCouponUsable(coupon, cart.subtotal, cart.orderType);
    if (!usable.ok) return fail(usable.reason, 422);

    const priorUses = await db.order.count({
      where: {
        userId: user.id,
        couponCode: coupon.code,
        status: { not: "CANCELLED" },
      },
    });
    if (priorUses >= coupon.perUserLimit) {
      return fail("You have already used this coupon.", 422);
    }

    discount = computeDiscount(coupon, cart.subtotal);
    appliedCoupon = coupon.code;
  }

  const discountedSubtotal = cart.subtotal - discount;
  const shippingFee = shippingFeeFor(discountedSubtotal, cart.orderType);
  const tax = taxFor(cart.lines);
  const total = discountedSubtotal + shippingFee + tax;

  if (total < 0) return fail("Order total could not be calculated.", 500);

  // COD has a ceiling; above it we require prepayment.
  if (paymentMethod === "COD" && total > 1_000_000) {
    return fail("Cash on Delivery is not available on orders above ₹10,000.", 422);
  }

  const shippingSnapshot = JSON.stringify({
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: address.country,
  });

  let order: { id: string; orderNumber: string; total: number };

  try {
    order = await db.$transaction(async (tx) => {
    // Re-read stock inside the transaction and decrement conditionally.
    // Two shoppers racing for the last piece cannot both succeed, because the
    // updateMany below only matches while stock is still sufficient.
    for (const line of cart.lines) {
      if (line.variantId) {
        const updated = await tx.productVariant.updateMany({
          where: { id: line.variantId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (updated.count === 0) {
          throw new StockError(`"${line.title}" just went out of stock.`);
        }
      }

      const updatedProduct = await tx.product.updateMany({
        where: { id: line.productId, stock: { gte: line.quantity } },
        data: {
          stock: { decrement: line.quantity },
          soldCount: { increment: line.quantity },
        },
      });
      if (updatedProduct.count === 0) {
        throw new StockError(`"${line.title}" just went out of stock.`);
      }
    }

    if (appliedCoupon) {
      await tx.coupon.update({
        where: { code: appliedCoupon },
        data: { usedCount: { increment: 1 } },
      });
    }

    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: user.id,
        addressId: address.id,
        shippingSnapshot,
        status: "PENDING",
        // A real payment gateway would confirm this asynchronously via webhook.
        // Until that integration exists, only COD is treated as a placed order
        // and prepaid methods stay PENDING rather than being marked PAID here.
        paymentStatus: "PENDING",
        paymentMethod,
        subtotal: cart.subtotal,
        discount,
        shippingFee,
        tax,
        total,
        couponCode: appliedCoupon,
        orderType: cart.orderType,
        customerNote: customerNote || null,
        items: {
          create: cart.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            titleSnapshot: line.title,
            skuSnapshot: line.sku,
            imageSnapshot: line.image,
            variantLabel: line.variantLabel,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
          })),
        },
        events: {
          create: { status: "PENDING", note: "Order placed" },
        },
      },
      select: { id: true, orderNumber: true, total: true },
    });

      await tx.cartItem.deleteMany({ where: { userId: user.id } });

      return created;
    });
  } catch (error) {
    // Stock exhaustion is a normal, recoverable outcome of a race — the whole
    // transaction has rolled back, so nothing was reserved or charged.
    if (error instanceof StockError) return fail(error.message, 409);
    throw error;
  }

  await audit({
    userId: user.id,
    actorEmail: user.email,
    action: "order.create",
    entity: "Order",
    entityId: order.id,
    metadata: {
      orderNumber: order.orderNumber,
      total: order.total,
      paymentMethod,
      coupon: appliedCoupon,
    },
  });

  return ok({ orderNumber: order.orderNumber, total: order.total }, 201);
});

