# 05 — Lifecycles (state machines)

Each lifecycle is enforced in one place in code (`src/server/*/transitions.ts`). Every transition is a conditional update inside a transaction, writes a history row, and queues the customer notification.

## 1. Order

```mermaid
stateDiagram-v2
  [*] --> PENDING_PAYMENT: prepaid order placed (stock reserved)
  [*] --> CONFIRMED: COD order placed (OTP if above limit)
  PENDING_PAYMENT --> CONFIRMED: Razorpay payment.captured (webhook)
  PENDING_PAYMENT --> PAYMENT_FAILED: payment.failed
  PAYMENT_FAILED --> PENDING_PAYMENT: customer retries
  PENDING_PAYMENT --> CANCELLED: paymentDueBy passed / customer cancels
  PAYMENT_FAILED --> CANCELLED: paymentDueBy passed
  CONFIRMED --> PROCESSING: staff starts packing
  CONFIRMED --> CANCELLED: customer or staff
  PROCESSING --> PACKED: weight and box entered
  PROCESSING --> CANCELLED: staff
  PACKED --> SHIPPED: courier pickup scan
  PACKED --> CANCELLED: staff (shipment cancelled first)
  SHIPPED --> OUT_FOR_DELIVERY
  SHIPPED --> RTO_IN_TRANSIT: returned by courier
  OUT_FOR_DELIVERY --> DELIVERED
  OUT_FOR_DELIVERY --> SHIPPED: delivery failed (NDR), re-attempt
  OUT_FOR_DELIVERY --> RTO_IN_TRANSIT: NDR not resolved
  RTO_IN_TRANSIT --> RTO_DELIVERED: back at Sanganer
  DELIVERED --> [*]
  CANCELLED --> [*]
  RTO_DELIVERED --> [*]
```

| Transition | Who | Side effects |
|---|---|---|
| → PENDING_PAYMENT | Customer | Stock decremented (ledger `ORDER_PLACED`), coupon redeemed, Razorpay order created, `paymentDueBy` set |
| → CONFIRMED | Webhook / COD placement | Payment recorded; invoice issued (if the setting says "on confirm"); "Order confirmed" email + SMS/WhatsApp |
| → CANCELLED | Customer (before PACKED), staff, expiry job | Stock restored (ledger `ORDER_CANCELLED` / `ORDER_EXPIRED`), coupon released, prepaid → automatic full refund, credit note if invoiced, notification |
| → PACKED | Dispatch staff | Shipment created on Shiprocket → AWB, label |
| → SHIPPED / OUT_FOR_DELIVERY / DELIVERED | Shiprocket webhook (or staff manually) | Tracking timeline updated; "Shipped" message with tracking link; COD marked paid on delivery remittance |
| → RTO_DELIVERED | Webhook / staff | QC → restock; prepaid → refund (minus shipping if the policy says so — owner decides) |

Returns **don't** change the order's status. One order can have several partial returns, so they live on `ReturnRequest`. The customer's order page combines both into one timeline.

## 2. Payment (each attempt)

```mermaid
stateDiagram-v2
  [*] --> CREATED: Razorpay order created
  CREATED --> CAPTURED: payment.captured (auto-capture on)
  CREATED --> AUTHORIZED: payment.authorized
  AUTHORIZED --> CAPTURED: capture
  CREATED --> FAILED: payment.failed
  AUTHORIZED --> FAILED
  CAPTURED --> PARTIALLY_REFUNDED: refund < amount
  CAPTURED --> REFUNDED: refund = amount
  PARTIALLY_REFUNDED --> REFUNDED
```

**The order is marked paid only by the verified webhook** (HMAC-SHA256 on the raw body, timing-safe compare, event id stored so duplicates are ignored). The browser's "success" redirect only *checks* the status. It never sets it. A daily reconciliation job compares Razorpay with the database and flags mismatches.

Order-level `paymentStatus` is calculated from all attempts and refunds: PENDING → PAID (or PARTIALLY_PAID for a wholesale advance) → PARTIALLY_REFUNDED / REFUNDED; FAILED when the last attempt failed and nothing is paid.

## 3. Shipment

```mermaid
stateDiagram-v2
  [*] --> CREATED
  CREATED --> AWB_ASSIGNED
  AWB_ASSIGNED --> PICKUP_SCHEDULED
  PICKUP_SCHEDULED --> PICKED_UP
  PICKED_UP --> IN_TRANSIT
  IN_TRANSIT --> OUT_FOR_DELIVERY
  OUT_FOR_DELIVERY --> DELIVERED
  OUT_FOR_DELIVERY --> NDR: delivery attempt failed
  NDR --> OUT_FOR_DELIVERY: re-attempt (customer chose new slot / fixed address)
  NDR --> RTO_INITIATED
  IN_TRANSIT --> RTO_INITIATED
  RTO_INITIATED --> RTO_IN_TRANSIT
  RTO_IN_TRANSIT --> RTO_DELIVERED
  IN_TRANSIT --> LOST
  CREATED --> CANCELLED
  AWB_ASSIGNED --> CANCELLED
  PICKUP_SCHEDULED --> CANCELLED
```

Courier scans arrive by webhook, with polling every 2 hours as a fallback. Each scan is stored once (`dedupeKey`). Courier statuses map to the order status in one table in code.

## 4. Return / exchange

```mermaid
stateDiagram-v2
  [*] --> REQUESTED: customer, within return window, with photos
  REQUESTED --> APPROVED: staff
  REQUESTED --> REJECTED: staff, with reason
  REQUESTED --> CANCELLED: customer withdraws
  APPROVED --> PICKUP_SCHEDULED: Shiprocket reverse pickup
  APPROVED --> RECEIVED: customer self-ships
  PICKUP_SCHEDULED --> PICKED_UP
  PICKED_UP --> RECEIVED
  RECEIVED --> QC_PASSED
  RECEIVED --> QC_FAILED
  QC_PASSED --> REFUNDED: refund issued
  QC_PASSED --> EXCHANGED: replacement order created
  QC_FAILED --> CLOSED: item returned to customer / partial refund per policy
  REFUNDED --> CLOSED
  EXCHANGED --> CLOSED
```

Stock is restored **only on QC_PASSED** (ledger `RETURN_RESTOCKED`). Items marked non-returnable in Settings or on the product can't be selected for return.

## 5. Refund

```mermaid
stateDiagram-v2
  [*] --> INITIATED
  INITIATED --> PROCESSING: sent to Razorpay / bank / UPI, or credited
  PROCESSING --> COMPLETED: refund.processed webhook / payout confirmed
  PROCESSING --> FAILED
  FAILED --> INITIATED: retry with a new idempotency key
```

Guard rails:
- `amount ≤ amountPaid − amountRefunded`, checked inside the transaction.
- One idempotency key per attempt.
- A credit note is issued for any invoiced amount.
- Store-credit refunds complete instantly.

## 6. Wholesale application

```mermaid
stateDiagram-v2
  [*] --> PENDING: sign-up with business details + GSTIN + documents
  PENDING --> APPROVED: staff verifies GSTIN, assigns tier and payment terms
  PENDING --> REJECTED: with reason (customer can fix and re-apply)
  REJECTED --> PENDING: re-applies
  APPROVED --> SUSPENDED: staff
  SUSPENDED --> APPROVED: staff
  APPROVED --> PENDING: buyer changes GSTIN or business name
```

Approval sets `User.customerType = WHOLESALE` and revokes the buyer's sessions so the new prices apply immediately. The buyer gets an email + WhatsApp message either way.

## 7. Customer-facing tracking timeline

What the customer sees on `/account/orders/{number}` and `/track`. It's merged from `OrderStatusHistory`, `ShipmentEvent`, `ReturnRequest` and `Refund`:

**Order placed → Payment received → Packed → Shipped (courier, AWB, link) → In transit (city scans) → Out for delivery → Delivered → Return requested → Pickup scheduled → Picked up → Received & checked → Refund issued (₹ amount, method, reference) → Refund credited**
