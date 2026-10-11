/**
 * Every lifecycle in one place (docs/phase-1/05-state-machines.md). Services
 * call assertTransition() before writing, and then write with a conditional
 * `WHERE status = from` so a double click or two staff members cannot apply
 * the same change twice (fixes H2).
 */

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_FAILED"
  | "CONFIRMED"
  | "PROCESSING"
  | "PACKED"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "RTO_IN_TRANSIT"
  | "RTO_DELIVERED";

export type ShipmentStatus =
  | "CREATED"
  | "AWB_ASSIGNED"
  | "PICKUP_SCHEDULED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "NDR"
  | "DELIVERED"
  | "RTO_INITIATED"
  | "RTO_IN_TRANSIT"
  | "RTO_DELIVERED"
  | "CANCELLED"
  | "LOST";

export type ReturnStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "PICKUP_SCHEDULED"
  | "PICKED_UP"
  | "RECEIVED"
  | "QC_PASSED"
  | "QC_FAILED"
  | "REFUNDED"
  | "EXCHANGED"
  | "CLOSED"
  | "CANCELLED";

export type RefundStatus = "INITIATED" | "PROCESSING" | "COMPLETED" | "FAILED";
export type WholesaleStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type Actor = "CUSTOMER" | "STAFF" | "SYSTEM";

type Rule<S extends string> = { to: S; by: Actor[] };

export const ORDER_TRANSITIONS: Record<OrderStatus, Rule<OrderStatus>[]> = {
  PENDING_PAYMENT: [
    { to: "CONFIRMED", by: ["SYSTEM", "STAFF"] },
    { to: "PAYMENT_FAILED", by: ["SYSTEM"] },
    { to: "CANCELLED", by: ["CUSTOMER", "STAFF", "SYSTEM"] },
  ],
  PAYMENT_FAILED: [
    { to: "PENDING_PAYMENT", by: ["CUSTOMER", "SYSTEM"] },
    { to: "CONFIRMED", by: ["SYSTEM", "STAFF"] },
    { to: "CANCELLED", by: ["CUSTOMER", "STAFF", "SYSTEM"] },
  ],
  CONFIRMED: [
    { to: "PROCESSING", by: ["STAFF"] },
    { to: "CANCELLED", by: ["CUSTOMER", "STAFF"] },
  ],
  PROCESSING: [
    { to: "PACKED", by: ["STAFF"] },
    { to: "CANCELLED", by: ["STAFF"] },
  ],
  PACKED: [
    { to: "SHIPPED", by: ["STAFF", "SYSTEM"] },
    { to: "CANCELLED", by: ["STAFF"] },
  ],
  SHIPPED: [
    { to: "OUT_FOR_DELIVERY", by: ["STAFF", "SYSTEM"] },
    { to: "DELIVERED", by: ["STAFF", "SYSTEM"] },
    { to: "RTO_IN_TRANSIT", by: ["STAFF", "SYSTEM"] },
  ],
  OUT_FOR_DELIVERY: [
    { to: "DELIVERED", by: ["STAFF", "SYSTEM"] },
    { to: "SHIPPED", by: ["STAFF", "SYSTEM"] },
    { to: "RTO_IN_TRANSIT", by: ["STAFF", "SYSTEM"] },
  ],
  RTO_IN_TRANSIT: [{ to: "RTO_DELIVERED", by: ["STAFF", "SYSTEM"] }],
  DELIVERED: [],
  CANCELLED: [],
  RTO_DELIVERED: [],
};

export const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  CREATED: ["AWB_ASSIGNED", "CANCELLED"],
  AWB_ASSIGNED: ["PICKUP_SCHEDULED", "PICKED_UP", "CANCELLED"],
  PICKUP_SCHEDULED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "RTO_INITIATED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED", "RTO_INITIATED", "LOST"],
  OUT_FOR_DELIVERY: ["DELIVERED", "NDR", "IN_TRANSIT", "RTO_INITIATED"],
  NDR: ["OUT_FOR_DELIVERY", "IN_TRANSIT", "DELIVERED", "RTO_INITIATED"],
  RTO_INITIATED: ["RTO_IN_TRANSIT", "RTO_DELIVERED"],
  RTO_IN_TRANSIT: ["RTO_DELIVERED"],
  DELIVERED: [],
  RTO_DELIVERED: [],
  CANCELLED: [],
  LOST: [],
};

export const RETURN_TRANSITIONS: Record<ReturnStatus, Rule<ReturnStatus>[]> = {
  REQUESTED: [
    { to: "APPROVED", by: ["STAFF"] },
    { to: "REJECTED", by: ["STAFF"] },
    { to: "CANCELLED", by: ["CUSTOMER", "STAFF"] },
  ],
  APPROVED: [
    { to: "PICKUP_SCHEDULED", by: ["STAFF", "SYSTEM"] },
    { to: "RECEIVED", by: ["STAFF"] },
    { to: "CANCELLED", by: ["CUSTOMER", "STAFF"] },
  ],
  PICKUP_SCHEDULED: [
    { to: "PICKED_UP", by: ["STAFF", "SYSTEM"] },
    { to: "CANCELLED", by: ["STAFF"] },
  ],
  PICKED_UP: [{ to: "RECEIVED", by: ["STAFF", "SYSTEM"] }],
  RECEIVED: [
    { to: "QC_PASSED", by: ["STAFF"] },
    { to: "QC_FAILED", by: ["STAFF"] },
  ],
  QC_PASSED: [
    { to: "REFUNDED", by: ["STAFF", "SYSTEM"] },
    { to: "EXCHANGED", by: ["STAFF", "SYSTEM"] },
  ],
  QC_FAILED: [{ to: "CLOSED", by: ["STAFF"] }],
  REFUNDED: [{ to: "CLOSED", by: ["STAFF", "SYSTEM"] }],
  EXCHANGED: [{ to: "CLOSED", by: ["STAFF", "SYSTEM"] }],
  REJECTED: [],
  CLOSED: [],
  CANCELLED: [],
};

export const REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  INITIATED: ["PROCESSING", "COMPLETED", "FAILED"],
  PROCESSING: ["COMPLETED", "FAILED"],
  FAILED: ["INITIATED"],
  COMPLETED: [],
};

export const WHOLESALE_TRANSITIONS: Record<WholesaleStatus, WholesaleStatus[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["SUSPENDED", "PENDING"],
  REJECTED: ["PENDING"],
  SUSPENDED: ["APPROVED"],
};

export class TransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
    message: string,
  ) {
    super(message);
    this.name = "TransitionError";
  }
}

const label = (s: string) => s.toLowerCase().replace(/_/g, " ");

export function canTransitionOrder(from: OrderStatus, to: OrderStatus, actor: Actor): boolean {
  return ORDER_TRANSITIONS[from].some((rule) => rule.to === to && rule.by.includes(actor));
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus, actor: Actor): void {
  if (!canTransitionOrder(from, to, actor)) {
    throw new TransitionError(from, to, `An order that is ${label(from)} cannot be moved to ${label(to)}.`);
  }
}

export function canTransitionReturn(from: ReturnStatus, to: ReturnStatus, actor: Actor): boolean {
  return RETURN_TRANSITIONS[from].some((rule) => rule.to === to && rule.by.includes(actor));
}

export function assertReturnTransition(from: ReturnStatus, to: ReturnStatus, actor: Actor): void {
  if (!canTransitionReturn(from, to, actor)) {
    throw new TransitionError(from, to, `A return that is ${label(from)} cannot be moved to ${label(to)}.`);
  }
}

export function assertSimpleTransition<S extends string>(
  table: Record<S, S[]>,
  from: S,
  to: S,
  noun: string,
): void {
  if (!table[from].includes(to)) {
    throw new TransitionError(from, to, `A ${noun} that is ${label(from)} cannot be moved to ${label(to)}.`);
  }
}

/** Statuses from which the customer may still cancel by themselves. */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = (Object.keys(ORDER_TRANSITIONS) as OrderStatus[]).filter(
  (status) => canTransitionOrder(status, "CANCELLED", "CUSTOMER"),
);

/** How a courier scan moves the order. null = no order change. */
export function orderStatusForShipment(status: ShipmentStatus): OrderStatus | null {
  switch (status) {
    case "PICKED_UP":
    case "IN_TRANSIT":
      return "SHIPPED";
    case "OUT_FOR_DELIVERY":
      return "OUT_FOR_DELIVERY";
    case "NDR":
      return "SHIPPED";
    case "DELIVERED":
      return "DELIVERED";
    case "RTO_INITIATED":
    case "RTO_IN_TRANSIT":
      return "RTO_IN_TRANSIT";
    case "RTO_DELIVERED":
      return "RTO_DELIVERED";
    default:
      return null;
  }
}
