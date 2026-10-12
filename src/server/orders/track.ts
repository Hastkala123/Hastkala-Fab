import "server-only";

import { db } from "@/lib/db";
import { normalizeIndianMobile } from "@/lib/phone";
import { ORDER_STATUS_LABELS } from "@/lib/utils";
import { NotFoundError } from "@/server/errors";

/**
 * Public order tracking (/track). The order number alone is not enough — it
 * is printed on parcels and easy to guess — so the email or mobile number the
 * order was placed with must match too. Every miss gets the same answer, and
 * the route limits attempts per visitor and per order number.
 * Only status and items are shown: no address, phone or payment details.
 */

export type TrackedOrder = {
  orderNumber: string;
  status: string;
  statusLabel: string;
  placedAt: string;
  items: { title: string; variantLabel: string | null; quantity: number }[];
  history: { status: string; label: string; note: string | null; at: string }[];
};

export const TRACK_NOT_FOUND =
  "We couldn't find an order with these details. Check the order number, and use the email or mobile number you ordered with.";

export async function trackOrder(input: { orderNumber: string; contact: string }): Promise<TrackedOrder> {
  const email = input.contact.includes("@") ? input.contact.trim().toLowerCase() : null;
  const phone = email ? null : normalizeIndianMobile(input.contact);
  if (!email && !phone) throw new NotFoundError(TRACK_NOT_FOUND);

  const order = await db.order.findUnique({
    where: { orderNumber: input.orderNumber },
    select: {
      orderNumber: true,
      status: true,
      placedAt: true,
      contactEmail: true,
      contactPhone: true,
      user: { select: { email: true, phone: true } },
      items: { orderBy: { id: "asc" }, select: { title: true, variantLabel: true, quantity: true } },
      statusHistory: {
        where: { isCustomerVisible: true },
        orderBy: { createdAt: "asc" },
        select: { toStatus: true, note: true, createdAt: true },
      },
    },
  });

  const matches =
    order &&
    (email
      ? [order.contactEmail, order.user.email].some((known) => known?.toLowerCase() === email)
      : [order.contactPhone, order.user.phone].some((known) => known && normalizeIndianMobile(known) === phone));
  if (!order || !matches) throw new NotFoundError(TRACK_NOT_FOUND);

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status] ?? order.status,
    placedAt: order.placedAt.toISOString(),
    items: order.items,
    history: order.statusHistory.map((event) => ({
      status: event.toStatus,
      label: ORDER_STATUS_LABELS[event.toStatus] ?? event.toStatus,
      note: event.note,
      at: event.createdAt.toISOString(),
    })),
  };
}
