import { z } from "zod";
import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { cuidSchema, safeText } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** Once an order is packed it is physically in the courier pipeline. */
const CANCELLABLE = new Set(["PENDING", "CONFIRMED"]);

export const POST = handler(async (request) => {
  const gate = await guard({
    auth: "user",
    csrf: true,
    limit: { bucket: "order-cancel", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const user = gate.ctx.user!;

  const parsed = await parseJson(
    request,
    z.object({
      orderId: cuidSchema,
      reason: safeText(0, 300, "Reason").optional().or(z.literal("")),
    }),
  );
  if (!parsed.ok) return parsed.response;

  const order = await db.order.findFirst({
    where: { id: parsed.data.orderId, userId: user.id },
    include: { items: true },
  });
  if (!order) return fail("Order not found.", 404);

  if (!CANCELLABLE.has(order.status)) {
    return fail(
      `This order is already ${order.status.toLowerCase()} and can no longer be cancelled. Please raise a return request instead.`,
      409,
    );
  }

  await db.$transaction(async (tx) => {
    // Return the reserved stock to the pool.
    for (const item of order.items) {
      if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            soldCount: { decrement: item.quantity },
          },
        });
      }
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    if (order.couponCode) {
      await tx.coupon
        .update({
          where: { code: order.couponCode },
          data: { usedCount: { decrement: 1 } },
        })
        .catch(() => undefined); // Coupon may have been deleted since.
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        paymentStatus: order.paymentStatus === "PAID" ? "REFUNDED" : "FAILED",
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: "CANCELLED",
        note: parsed.data.reason
          ? `Cancelled by customer — ${parsed.data.reason}`
          : "Cancelled by customer",
      },
    });
  });

  await audit({
    userId: user.id,
    actorEmail: user.email,
    action: "order.cancel",
    entity: "Order",
    entityId: order.id,
    metadata: { orderNumber: order.orderNumber, reason: parsed.data.reason },
  });

  return ok({ success: true });
});
