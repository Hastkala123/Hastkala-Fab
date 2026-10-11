import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { orderStatusSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Legal status transitions. Enforcing a state machine here stops an accidental
 * click moving a delivered order back to "packed", which would corrupt both the
 * customer's tracking view and the sales reporting.
 */
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

export const PATCH = handler(async (request) => {
  const gate = await guard({
    auth: "admin",
    csrf: true,
    limit: { bucket: "admin-order", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const admin = gate.ctx.user!;

  const parsed = await parseJson(request, orderStatusSchema);
  if (!parsed.ok) return parsed.response;

  const { orderId, status, trackingNumber, courierName, note } = parsed.data;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return fail("Order not found.", 404);

  if (order.status === status) {
    return fail(`This order is already marked ${status.toLowerCase()}.`, 409);
  }

  const allowed = TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(status)) {
    return fail(
      `An order that is ${order.status.toLowerCase()} cannot be moved to ${status.toLowerCase()}.`,
      409,
    );
  }

  await db.$transaction(async (tx) => {
    // Cancelling or returning releases the reserved stock back to the pool.
    if (status === "CANCELLED" || status === "RETURNED") {
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
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status,
        trackingNumber: trackingNumber || order.trackingNumber,
        courierName: courierName || order.courierName,
        deliveredAt: status === "DELIVERED" ? new Date() : order.deliveredAt,
        cancelledAt: status === "CANCELLED" ? new Date() : order.cancelledAt,
        // Delivery of a COD order is the moment payment is actually received.
        paymentStatus:
          status === "DELIVERED" && order.paymentMethod === "COD"
            ? "PAID"
            : status === "RETURNED" && order.paymentStatus === "PAID"
              ? "REFUNDED"
              : order.paymentStatus,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status,
        note: note || `Marked ${status.toLowerCase()} by ${admin.name}`,
      },
    });
  });

  await audit({
    userId: admin.id,
    actorEmail: admin.email,
    action: "order.status.update",
    entity: "Order",
    entityId: order.id,
    metadata: {
      orderNumber: order.orderNumber,
      from: order.status,
      to: status,
      trackingNumber,
    },
  });

  return ok({ success: true });
});
