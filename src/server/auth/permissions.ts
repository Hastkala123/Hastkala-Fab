/**
 * Staff permissions. Roles (StaffRole rows) are editable by the owner in
 * Admin → Staff; this file only defines which permission keys exist.
 */

export const PERMISSIONS = {
  "dashboard.view": "See the dashboard",
  "orders.view": "View orders",
  "orders.manage": "Change, edit and cancel orders; create manual orders",
  "shipping.manage": "Create shipments, print labels, handle failed deliveries",
  "returns.manage": "Approve returns, schedule pickups, quality checks",
  "refunds.issue": "Issue refunds and store credit",
  "payments.verify": "Verify bank transfers and reconcile payments",
  "invoices.manage": "Invoices, credit notes and GST reports",
  "catalog.manage": "Products, categories, collections, product fields",
  "inventory.manage": "Adjust stock",
  "customers.view": "View customers",
  "customers.manage": "Edit and block customers",
  "wholesale.manage": "Approve wholesale buyers, price tiers, inquiries",
  "marketing.manage": "Coupons, banners, homepage sections",
  "content.manage": "Pages, FAQs, blog, message templates, redirects",
  "reviews.manage": "Moderate reviews",
  "support.manage": "Answer support tickets",
  "settings.manage": "Store settings, tax rules",
  "staff.manage": "Staff accounts and roles",
  "audit.view": "Audit log",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Roles seeded at launch. All are editable; none can grant staff.manage except Owner. */
export const SYSTEM_ROLES: { name: string; description: string; permissions: Permission[] }[] = [
  {
    name: "Manager",
    description: "Runs the shop day to day: everything except staff accounts.",
    permissions: ALL_PERMISSIONS.filter((p) => p !== "staff.manage"),
  },
  {
    name: "Catalog",
    description: "Adds and edits products, photos, stock and website content.",
    permissions: ["dashboard.view", "catalog.manage", "inventory.manage", "content.manage", "marketing.manage"],
  },
  {
    name: "Dispatch",
    description: "Packs and ships orders, handles pickups and returned parcels.",
    permissions: ["dashboard.view", "orders.view", "shipping.manage", "returns.manage", "inventory.manage"],
  },
  {
    name: "Support",
    description: "Answers customers: tickets, reviews, order questions.",
    permissions: ["dashboard.view", "orders.view", "customers.view", "support.manage", "reviews.manage", "returns.manage"],
  },
  {
    name: "Accounts",
    description: "Payments, refunds, invoices and GST reports.",
    permissions: ["dashboard.view", "orders.view", "payments.verify", "refunds.issue", "invoices.manage", "customers.view"],
  },
];

export type PermissionHolder = { isStaff: boolean; isOwner: boolean; permissions: readonly string[] };

export function hasPermission(user: PermissionHolder | null | undefined, permission: Permission): boolean {
  if (!user?.isStaff) return false;
  return user.isOwner || user.permissions.includes(permission);
}
