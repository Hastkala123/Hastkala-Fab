import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { formatDate, ORDER_STATUS_LABELS, STATUS_STYLES } from "@/lib/utils";
import { istStartOfDay, istDateString } from "@/lib/time";
import { requireStaffPage } from "@/server/auth/page-guard";
import { SETTING_KEYS, SETTING_LABELS } from "@/server/settings/schema";
import { getSettings } from "@/server/settings";
import { gatewayStatus } from "@/server/payments/gateway";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/** Orders that count as sales: placed and not cancelled, failed or unpaid. */
const SOLD = { notIn: ["CANCELLED", "PAYMENT_FAILED", "PENDING_PAYMENT"] } as const;

export default async function AdminDashboard() {
  const admin = await requireStaffPage("dashboard.view");

  const now = new Date();
  const startOfToday = istStartOfDay(istDateString(now));
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [
    revenue,
    revenue30,
    todayOrders,
    toDispatch,
    productCount,
    activeProducts,
    customerCount,
    pendingWholesale,
    pendingReviews,
    openTickets,
    lowStockRows,
    recentOrders,
    topProducts,
    settings,
    paymentFlags,
    failedRefunds,
  ] = await Promise.all([
    db.order.aggregate({ where: { status: { notIn: [...SOLD.notIn] } }, _sum: { grandTotal: true }, _count: { id: true } }),
    db.order.aggregate({
      where: { status: { notIn: [...SOLD.notIn] }, placedAt: { gte: thirtyDaysAgo } },
      _sum: { grandTotal: true },
    }),
    db.order.count({ where: { placedAt: { gte: startOfToday } } }),
    db.order.count({ where: { status: { in: ["CONFIRMED", "PROCESSING", "PACKED"] } } }),
    db.product.count({ where: { status: { not: "ARCHIVED" } } }),
    db.product.count({ where: { status: "ACTIVE" } }),
    db.user.count({ where: { isStaff: false, status: "ACTIVE" } }),
    db.wholesaleProfile.count({ where: { status: "PENDING" } }),
    db.review.count({ where: { status: "PENDING" } }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    // Each variant has its own low-stock level, set in the product form.
    db.$queryRaw<{ id: string; productId: string; title: string; label: string | null; stock: number }[]>`
      SELECT v."id", v."productId", p."title", concat_ws(' · ', v."size", v."colorName") AS label, v."stock"
        FROM "ProductVariant" v JOIN "Product" p ON p."id" = v."productId"
       WHERE p."status" = 'ACTIVE' AND v."isActive" AND v."archivedAt" IS NULL AND v."stock" <= v."lowStockThreshold"
       ORDER BY v."stock" ASC, p."title" ASC
       LIMIT 8`,
    db.order.findMany({
      orderBy: { placedAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, email: true, phone: true } }, _count: { select: { items: true } } },
    }),
    db.orderItem.groupBy({
      by: ["productId", "title"],
      where: { productId: { not: null }, order: { status: { notIn: [...SOLD.notIn] }, placedAt: { gte: thirtyDaysAgo } } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    getSettings(),
    db.payment.count({ where: { attentionAt: { not: null } } }),
    db.refund.count({ where: { status: "FAILED" } }),
  ]);
  const lowStock = lowStockRows;
  const gateway = gatewayStatus();
  const pendingOrders = toDispatch;
  const unsavedSettings = SETTING_KEYS.filter((key) => !settings._saved.has(key));

  const actionItems = [
    paymentFlags > 0 && {
      label: `${paymentFlags} payment${paymentFlags === 1 ? "" : "s"} need${paymentFlags === 1 ? "s" : ""} a look`,
      href: "/admin/payments",
    },
    failedRefunds > 0 && {
      label: `${failedRefunds} refund${failedRefunds === 1 ? "" : "s"} failed — retry or refund by hand`,
      href: "/admin/payments",
    },
    gateway.mode === "off" && {
      label: "Online payment is off: add the Razorpay keys to take UPI, card and net banking",
      href: "/admin/payments",
    },
    gateway.mode === "stand-in" && {
      label: "Online payments use the built-in test gateway — add Razorpay keys before launch",
      href: "/admin/payments",
    },
    "webhooks" in gateway && !gateway.webhooks && {
      label: "Razorpay webhook secret missing — set RAZORPAY_WEBHOOK_SECRET",
      href: "/admin/payments",
    },
    pendingOrders > 0 && {
      label: `${pendingOrders} order${pendingOrders === 1 ? "" : "s"} awaiting dispatch`,
      href: "/admin/orders?status=CONFIRMED",
    },
    pendingWholesale > 0 && {
      label: `${pendingWholesale} wholesale account${pendingWholesale === 1 ? "" : "s"} to verify`,
      href: "/admin/customers?filter=pending-wholesale",
    },
    pendingReviews > 0 && {
      label: `${pendingReviews} review${pendingReviews === 1 ? "" : "s"} to moderate`,
      href: "/admin/reviews",
    },
    openTickets > 0 && {
      label: `${openTickets} open support ticket${openTickets === 1 ? "" : "s"}`,
      href: "/admin/tickets",
    },
    lowStock.length > 0 && {
      label: `${lowStock.length}${lowStock.length === 8 ? "+" : ""} size/colour${lowStock.length === 1 ? "" : "s"} low on stock`,
      href: "/admin/products?filter=low-stock",
    },
    unsavedSettings.length > 0 && {
      label: `Confirm store settings: ${unsavedSettings.map((k) => SETTING_LABELS[k]).join(", ")}`,
      href: "/admin/settings",
    },
    !settings.tax.ratesConfirmedByCa && {
      label: "GST rates are placeholders until your CA confirms them",
      href: "/admin/settings#tax",
    },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
          Welcome back, {admin.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Here is what is happening across the store today.
        </p>
      </div>

      {/* ---- KPIs ---- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Total revenue"
          value={formatPrice(revenue._sum.grandTotal ?? 0)}
          detail={`${revenue._count.id} orders all-time`}
        />
        <Kpi
          label="Revenue (30 days)"
          value={formatPrice(revenue30._sum.grandTotal ?? 0)}
          detail="Paid or confirmed orders"
        />
        <Kpi
          label="Orders today"
          value={String(todayOrders)}
          detail={`${pendingOrders} awaiting dispatch`}
          accent={pendingOrders > 0}
        />
        <Kpi
          label="Customers"
          value={String(customerCount)}
          detail={`${activeProducts} of ${productCount} products live`}
        />
      </div>

      {/* ---- Action items ---- */}
      {actionItems.length > 0 && (
        <section className="hf-card border-turmeric-300 bg-turmeric-50 p-5">
          <h2 className="font-display text-base font-bold text-turmeric-900">
            Needs your attention
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {actionItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-medium text-turmeric-900 transition hover:bg-white"
                >
                  <span aria-hidden="true">→</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {/* ---- Recent orders ---- */}
        <section className="hf-card overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-cotton-200 bg-cotton-100 px-5 py-3">
            <h2 className="font-display text-base font-bold text-indigo-ink-950">
              Recent orders
            </h2>
            <Link href="/admin/orders" className="hf-link text-sm font-semibold">
              View all →
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cotton-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Order</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Customer</th>
                    <th scope="col" className="px-5 py-2.5 font-semibold">Status</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cotton-200">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="transition hover:bg-cotton-50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/orders/${order.orderNumber}`}
                          className="font-semibold text-indigo-ink-800 hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                        <p className="text-xs text-slate-400">
                          {formatDate(order.placedAt)} · {order._count.items} items
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-indigo-ink-900">
                          {order.user.name}
                        </p>
                        <p className="text-xs text-slate-400">{order.user.email ?? order.user.phone}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`hf-badge ${STATUS_STYLES[order.status] ?? ""}`}>
                          {ORDER_STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-indigo-ink-950">
                        {formatPrice(order.grandTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-6">
          {/* ---- Low stock ---- */}
          <section className="hf-card p-5">
            <h2 className="font-display text-base font-bold text-indigo-ink-950">
              Low stock
            </h2>
            {lowStock.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Everything is comfortably stocked.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {lowStock.map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-3">
                    <Link
                      href={`/admin/products/${product.productId}`}
                      className="hf-clamp-1 min-w-0 text-sm text-indigo-ink-800 hover:underline"
                    >
                      {product.title}
                      {product.label ? ` (${product.label})` : ""}
                    </Link>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${
                        product.stock === 0
                          ? "bg-madder-100 text-madder-700"
                          : "bg-turmeric-100 text-turmeric-800"
                      }`}
                    >
                      {product.stock} left
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---- Top sellers ---- */}
          <section className="hf-card p-5">
            <h2 className="font-display text-base font-bold text-indigo-ink-950">
              Top sellers (30 days)
            </h2>
            {topProducts.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No sales recorded yet.</p>
            ) : (
              <ol className="mt-3 space-y-2.5">
                {topProducts.map((product, index) => (
                  <li key={product.productId} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-cotton-200 text-[10px] font-bold text-slate-600">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/admin/products/${product.productId}`}
                        className="hf-clamp-1 text-sm text-indigo-ink-800 hover:underline"
                      >
                        {product.title}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {product._sum.quantity ?? 0} sold · {formatPrice(product._sum.lineTotal ?? 0)} in 30 days
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      <section className="hf-card p-5">
        <h2 className="font-display text-base font-bold text-indigo-ink-950">
          Quick actions
        </h2>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <Link href="/admin/products/new" className="hf-btn hf-btn-primary">
            + Add product
          </Link>
          <Link href="/admin/categories" className="hf-btn hf-btn-outline">
            Manage categories
          </Link>
          <Link href="/admin/coupons" className="hf-btn hf-btn-outline">
            Create a coupon
          </Link>
          <Link href="/admin/orders" className="hf-btn hf-btn-outline">
            Process orders
          </Link>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className={`hf-card p-4 ${accent ? "border-turmeric-300 bg-turmeric-50" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold text-indigo-ink-950">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
