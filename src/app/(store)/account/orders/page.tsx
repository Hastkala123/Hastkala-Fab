import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUserPage } from "@/server/auth/page-guard";
import { formatPrice } from "@/lib/money";
import { formatDate, ORDER_STATUS_LABELS, STATUS_STYLES } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My Orders",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await requireUserPage();

  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { placedAt: "desc" },
    include: { items: { take: 4 }, _count: { select: { items: true } } },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950 sm:text-3xl">
        My orders
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {orders.length === 0
          ? "No orders yet."
          : `${orders.length} ${orders.length === 1 ? "order" : "orders"}`}
      </p>

      {orders.length === 0 ? (
        <div className="hf-card mt-6 p-10 text-center">
          <p className="text-sm text-slate-500">
            When you place an order it will appear here, with live tracking.
          </p>
          <Link href="/search" className="hf-btn hf-btn-primary mt-5">
            Browse the collection
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="hf-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cotton-200 bg-cotton-100 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
                  <div>
                    <p className="uppercase tracking-wide text-slate-500">Order</p>
                    <p className="font-semibold text-indigo-ink-900">
                      {order.orderNumber}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-slate-500">Placed</p>
                    <p className="font-semibold text-indigo-ink-900">
                      {formatDate(order.placedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide text-slate-500">Total</p>
                    <p className="font-semibold text-indigo-ink-900">
                      {formatPrice(order.grandTotal)}
                    </p>
                  </div>
                </div>

                <span className={`hf-badge ${STATUS_STYLES[order.status] ?? ""}`}>
                  {ORDER_STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex -space-x-3">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="relative aspect-square w-14 overflow-hidden rounded-lg border-2 border-white bg-cotton-100"
                    >
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.title}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-cotton-200" />
                      )}
                    </div>
                  ))}
                  {order._count.items > 4 && (
                    <div className="grid aspect-square w-14 place-items-center rounded-lg border-2 border-white bg-cotton-200 text-xs font-bold text-slate-600">
                      +{order._count.items - 4}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="hf-clamp-1 text-sm font-medium text-indigo-ink-900">
                    {order.items[0]?.title}
                    {order._count.items > 1 &&
                      ` and ${order._count.items - 1} more`}
                  </p>
                </div>

                <Link
                  href={`/account/orders/${order.orderNumber}`}
                  className="hf-btn hf-btn-outline shrink-0 py-2 text-sm"
                >
                  View details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
