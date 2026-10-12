/** Small shared helpers with no server-only dependencies. */

import { STATE_NAME_TO_CODE } from "./gstin";

export { formatDateIST as formatDate, formatDateTimeIST as formatDateTime } from "./time";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
}

// ---------------------------------------------------------------------------
// Status names shown to shoppers and staff
// ---------------------------------------------------------------------------

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAYMENT_FAILED: "Payment failed",
  CONFIRMED: "Confirmed",
  PROCESSING: "Being prepared",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RTO_IN_TRANSIT: "Returning to us",
  RTO_DELIVERED: "Returned to us",
};

/** The happy path, for the order-tracking stepper. */
export const ORDER_FLOW = ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Not paid yet",
  PARTIALLY_PAID: "Part paid",
  PAID: "Paid",
  PARTIALLY_REFUNDED: "Part refunded",
  REFUNDED: "Refunded",
  FAILED: "Failed",
};

export const REFUND_STATUS_LABELS: Record<string, string> = {
  INITIATED: "Started",
  PROCESSING: "In progress",
  COMPLETED: "Sent to your bank",
  FAILED: "Being retried by our team",
};

export const PAYMENT_ATTEMPT_LABELS: Record<string, string> = {
  CREATED: "Opened",
  AUTHORIZED: "Authorised",
  CAPTURED: "Paid",
  FAILED: "Failed",
  PARTIALLY_REFUNDED: "Part refunded",
  REFUNDED: "Refunded",
};

/** Refund states as staff see them. */
export const REFUND_STAFF_LABELS: Record<string, string> = {
  INITIATED: "Queued for the gateway",
  PROCESSING: "Processing at the gateway",
  COMPLETED: "Processed",
  FAILED: "Failed",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  UPI: "UPI",
  CARD: "Card",
  NETBANKING: "Net banking",
  WALLET: "Wallet",
  EMI: "EMI",
  COD: "Cash on delivery",
  BANK_TRANSFER: "Bank transfer",
  STORE_CREDIT: "Store credit",
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_ON_CUSTOMER: "Waiting for you",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const TICKET_CATEGORY_LABELS: Record<string, string> = {
  ORDER: "An order",
  PAYMENT: "Payment",
  DELIVERY: "Delivery",
  RETURN: "Return or exchange",
  PRODUCT: "A product",
  WHOLESALE: "Wholesale",
  ACCOUNT: "My account",
  OTHER: "Something else",
};

const GOOD = "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
const WAIT = "bg-amber-50 text-amber-700 ring-amber-600/20";
const INFO = "bg-blue-50 text-blue-700 ring-blue-600/20";
const MOVE = "bg-violet-50 text-violet-700 ring-violet-600/20";
const BAD = "bg-rose-50 text-rose-700 ring-rose-600/20";
const DONE = "bg-slate-100 text-slate-700 ring-slate-600/20";

export const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: WAIT,
  PAYMENT_FAILED: BAD,
  CONFIRMED: INFO,
  PROCESSING: INFO,
  PACKED: INFO,
  SHIPPED: MOVE,
  OUT_FOR_DELIVERY: MOVE,
  DELIVERED: GOOD,
  CANCELLED: BAD,
  RTO_IN_TRANSIT: WAIT,
  RTO_DELIVERED: DONE,
  PENDING: WAIT,
  PARTIALLY_PAID: WAIT,
  PAID: GOOD,
  PARTIALLY_REFUNDED: DONE,
  REFUNDED: DONE,
  FAILED: BAD,
  OPEN: WAIT,
  IN_PROGRESS: INFO,
  WAITING_ON_CUSTOMER: WAIT,
  RESOLVED: GOOD,
  CLOSED: DONE,
  APPROVED: GOOD,
  REJECTED: BAD,
  SUSPENDED: BAD,
  ACTIVE: GOOD,
  DRAFT: DONE,
  ARCHIVED: DONE,
};

export const ADMIN_PAGE_SIZE = 25;

/** Builds a compact pagination range like [1, "…", 4, 5, 6, "…", 20]. */
export function pageRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

/** States and union territories, A–Z, for address forms. */
export const INDIAN_STATES = Object.keys(STATE_NAME_TO_CODE).sort((a, b) => a.localeCompare(b));

/** Badge colours for one payment attempt (keys overlap with order statuses, so kept apart). */
export const PAYMENT_ATTEMPT_STYLES: Record<string, string> = {
  CREATED: DONE,
  AUTHORIZED: WAIT,
  CAPTURED: GOOD,
  FAILED: BAD,
  PARTIALLY_REFUNDED: WAIT,
  REFUNDED: DONE,
};
