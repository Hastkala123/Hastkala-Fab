import "server-only";

import type { InventoryReason, OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { NotFoundError, UserError } from "@/server/errors";
import { putBackStock } from "@/server/inventory/stock";
import { assertOrderTransition, CUSTOMER_CANCELLABLE, TransitionError, type Actor } from "./transitions";

export type OrderActor = { type: Actor; user: SessionUser | null };

export type ChangeStatusOptions = {
  note?: string | null;
  /** Shown on the customer's order page (staff-only notes are hidden). */
  customerVisible?: boolean;
  cancelReason?: string | null;
  /** Reject the change if the order has moved on since the staff member loaded it. */
  expectedFrom?: OrderStatus;
  /** Ledger reason for restocked items (expired payment vs. cancellation). */
  restockReason?: InventoryReason;
};

/**
 * The only way an order's status changes. Checks the move is allowed for this
 * actor, applies it with compare-and-set (two staff clicking at once can't both
 * apply it), and does what the move implies: stock back on cancellation and
 * return-to-origin, coupon released, cash collected on COD delivery.
 */
export async function changeOrderStatus(
  orderId: string,
  to: OrderStatus,
  actor: OrderActor,
  options: ChangeStatusOptions = {},
): Promise<void> {
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, couponRedemption: true },
    });
    if (!order) throw new NotFoundError("Order not found");

    const from = order.status;
    if (options.expectedFrom && options.expectedFrom !== from) {
      throw new TransitionError(from, to, "This order was just updated by someone else. Refresh to see the latest.");
    }
    assertOrderTransition(from, to, actor.type);

    const now = new Date();
    const data: Prisma.OrderUpdateManyMutationInput = { status: to };
    const notes: string[] = [];
    if (options.note) notes.push(options.note);

    if (to === "CONFIRMED") data.confirmedAt = now;

    if (to === "DELIVERED") {
      data.deliveredAt = now;
      if (order.paymentMethod === "COD" && order.amountPaid < order.grandTotal) {
        data.amountPaid = order.grandTotal;
        data.paymentStatus = "PAID";
      }
    }

    if (to === "CANCELLED") {
      data.cancelledAt = now;
      data.cancelReason = options.cancelReason ?? null;
      data.cancelledById = actor.user?.id ?? null;
      if (order.amountPaid > order.amountRefunded) {
        notes.push(`Refund of ${formatPrice(order.amountPaid - order.amountRefunded)} to be issued.`);
      }
    }

    const updated = await tx.order.updateMany({ where: { id: orderId, status: from }, data });
    if (updated.count === 0) {
      throw new TransitionError(from, to, "This order was just updated by someone else. Refresh to see the latest.");
    }

    if (to === "CANCELLED" || to === "RTO_DELIVERED") {
      const reason: InventoryReason = options.restockReason ?? "ORDER_CANCELLED";
      for (const item of order.items) {
        const open = item.quantity - item.quantityCancelled - item.quantityReturned;
        if (open <= 0 || !item.variantId) continue;
        await putBackStock(tx, item.variantId, open, {
          reason,
          orderId,
          actorId: actor.user?.id ?? null,
          note: to === "RTO_DELIVERED" ? "Returned to origin by courier" : null,
        });
        if (to === "CANCELLED") {
          await tx.orderItem.update({ where: { id: item.id }, data: { quantityCancelled: { increment: open } } });
        }
      }
    }

    if (to === "CANCELLED" && order.couponRedemption && !order.couponRedemption.releasedAt) {
      await tx.couponRedemption.update({ where: { id: order.couponRedemption.id }, data: { releasedAt: now } });
      await tx.$executeRaw`
        UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0), "updatedAt" = now()
         WHERE "id" = ${order.couponRedemption.couponId}`;
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: from,
        toStatus: to,
        note: notes.join(" ") || null,
        isCustomerVisible: options.customerVisible ?? true,
        actorType: actor.type,
        actorId: actor.user?.id ?? null,
      },
    });
    return { orderNumber: order.orderNumber, from };
  });

  if (actor.type === "STAFF") {
    await audit({
      actor: actor.user,
      action: "order.status",
      entityType: "Order",
      entityId: orderId,
      before: { status: result.from },
      after: { status: to, note: options.note ?? null },
    });
  }
}

/** "Cancel order" on the customer's order page. */
export async function cancelOrderByCustomer(user: SessionUser, orderNumber: string, reason: string | null) {
  const order = await db.order.findFirst({
    where: { orderNumber, userId: user.id },
    select: { id: true, status: true },
  });
  if (!order) throw new NotFoundError("Order not found");
  if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
    throw new UserError("This order is already being prepared, so it can't be cancelled online. Please contact us.", 409);
  }
  await changeOrderStatus(
    order.id,
    "CANCELLED",
    { type: "CUSTOMER", user },
    { cancelReason: reason, expectedFrom: order.status, note: reason ? `Cancelled by customer: ${reason}` : "Cancelled by customer" },
  );
}

/** Staff-only note on the order timeline. */
export async function addStaffNote(orderId: string, staff: SessionUser, note: string): Promise<void> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order) throw new NotFoundError("Order not found");
  await db.orderStatusHistory.create({
    data: {
      orderId,
      fromStatus: order.status,
      toStatus: order.status,
      note,
      isCustomerVisible: false,
      actorType: "STAFF",
      actorId: staff.id,
    },
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listCustomerOrders(userId: string, page = 1, pageSize = 10) {
  const where = { userId };
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        grandTotal: true,
        placedAt: true,
        items: { select: { title: true, imageUrl: true, quantity: true }, take: 4 },
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
  ]);
  return { orders, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getCustomerOrder(userId: string, orderNumber: string) {
  return db.order.findFirst({
    where: { orderNumber, userId },
    include: {
      items: { include: { product: { select: { slug: true } } } },
      statusHistory: { where: { isCustomerVisible: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

export type ShippingAddressSnapshot = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  country?: string;
};

export function readAddress(json: Prisma.JsonValue): ShippingAddressSnapshot | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  return json as unknown as ShippingAddressSnapshot;
}
