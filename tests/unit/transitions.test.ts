import { describe, expect, it } from "vitest";
import {
  assertOrderTransition,
  assertReturnTransition,
  assertSimpleTransition,
  canTransitionOrder,
  CUSTOMER_CANCELLABLE,
  ORDER_TRANSITIONS,
  orderStatusForShipment,
  REFUND_TRANSITIONS,
  SHIPMENT_TRANSITIONS,
  TransitionError,
  type OrderStatus,
} from "@/server/orders/transitions";

describe("order transitions", () => {
  it("lets a customer cancel only before packing starts", () => {
    expect(CUSTOMER_CANCELLABLE.sort()).toEqual(["CONFIRMED", "PAYMENT_FAILED", "PENDING_PAYMENT"]);
    expect(canTransitionOrder("PROCESSING", "CANCELLED", "CUSTOMER")).toBe(false);
    expect(canTransitionOrder("PROCESSING", "CANCELLED", "STAFF")).toBe(true);
  });

  it("only the payment system (or staff verifying a transfer) confirms an unpaid order", () => {
    expect(canTransitionOrder("PENDING_PAYMENT", "CONFIRMED", "CUSTOMER")).toBe(false);
    expect(canTransitionOrder("PENDING_PAYMENT", "CONFIRMED", "SYSTEM")).toBe(true);
  });

  it("never moves a delivered or cancelled order", () => {
    for (const to of Object.keys(ORDER_TRANSITIONS) as OrderStatus[]) {
      expect(canTransitionOrder("DELIVERED", to, "STAFF")).toBe(false);
      expect(canTransitionOrder("CANCELLED", to, "STAFF")).toBe(false);
    }
  });

  it("throws a readable error for an illegal move", () => {
    expect(() => assertOrderTransition("DELIVERED", "PACKED", "STAFF")).toThrow(
      "An order that is delivered cannot be moved to packed.",
    );
  });

  it("only references real statuses", () => {
    const all = new Set(Object.keys(ORDER_TRANSITIONS));
    for (const rules of Object.values(ORDER_TRANSITIONS)) {
      for (const rule of rules) expect(all.has(rule.to)).toBe(true);
    }
  });
});

describe("shipment → order mapping", () => {
  it("moves the order with courier scans", () => {
    expect(orderStatusForShipment("PICKED_UP")).toBe("SHIPPED");
    expect(orderStatusForShipment("OUT_FOR_DELIVERY")).toBe("OUT_FOR_DELIVERY");
    expect(orderStatusForShipment("DELIVERED")).toBe("DELIVERED");
    expect(orderStatusForShipment("RTO_DELIVERED")).toBe("RTO_DELIVERED");
    expect(orderStatusForShipment("AWB_ASSIGNED")).toBeNull();
  });

  it("every shipment status maps to a legal order move from the previous stage", () => {
    expect(canTransitionOrder("PACKED", orderStatusForShipment("PICKED_UP")!, "SYSTEM")).toBe(true);
    expect(canTransitionOrder("SHIPPED", orderStatusForShipment("DELIVERED")!, "SYSTEM")).toBe(true);
    expect(canTransitionOrder("OUT_FOR_DELIVERY", orderStatusForShipment("NDR")!, "SYSTEM")).toBe(true);
  });

  it("has a closed shipment table", () => {
    const all = new Set(Object.keys(SHIPMENT_TRANSITIONS));
    for (const next of Object.values(SHIPMENT_TRANSITIONS)) for (const s of next) expect(all.has(s)).toBe(true);
  });
});

describe("return and refund transitions", () => {
  it("restocks only through QC (no shortcut from received to refunded)", () => {
    expect(() => assertReturnTransition("RECEIVED", "REFUNDED", "STAFF")).toThrow(TransitionError);
    expect(() => assertReturnTransition("QC_PASSED", "REFUNDED", "SYSTEM")).not.toThrow();
  });

  it("lets a customer withdraw a return only before pickup", () => {
    expect(() => assertReturnTransition("APPROVED", "CANCELLED", "CUSTOMER")).not.toThrow();
    expect(() => assertReturnTransition("PICKED_UP", "CANCELLED", "CUSTOMER")).toThrow(TransitionError);
  });

  it("retries a failed refund but never re-opens a completed one", () => {
    expect(() => assertSimpleTransition(REFUND_TRANSITIONS, "FAILED", "INITIATED", "refund")).not.toThrow();
    expect(() => assertSimpleTransition(REFUND_TRANSITIONS, "COMPLETED", "INITIATED", "refund")).toThrow(
      TransitionError,
    );
  });
});
