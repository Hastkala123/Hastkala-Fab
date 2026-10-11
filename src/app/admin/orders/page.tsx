import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { formatDate, ORDER_STATUSES, STATUS_LABELS, STATUS_STYLES } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const PER_PAGE = 25;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q?.trim().slice(0, 60);

  const where: Prisma.OrderWhereInput = {};
  if (params.status && ORDER_STATUSES.includes(params.status as never)) {
    where.status = params.status;
  }
  if (search) {
    where.OR = [
      { orderNumber: { contains: search } },
      { user: { email: { contains: search } } },
      { user: { name: { contains: search } } },
    ];
  }

  const [orders, total, counts] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], _count: { id: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const countFor = (status: string) =>
    counts.find((c) => c.status === status)?._count.id ?? 0;

  function href(overrides: Record<string, string | undefined>) {
    const search = new URLSearchParams();
    const merged = { status: params.status, q: params.q, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) search.set(key, value);
    }
    const qs = search.toString();
    return qs ? `/admin/orders?${qs}` : "/admin/orders";
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
        Orders
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {total} {total === 1 ? "order" : "orders"}
        {params.status && ` with status ${params.status.toLowerCase()}`}
      </p>

      {/* Status tabs */}
      <nav aria-label="Filter by status" className="mt-5 flex flex-wrap gap-1.5">
        <Link
          href={href({ status: undefined, page: undefined })}
          className={
            !params.status
              ? "hf-btn hf-btn-primary py-1.5 text-sm"
              : "hf-btn hf-btn-outline py-1.5 text-sm"
          }
        >
          All ({counts.reduce((sum, c) => sum + c._count.id, 0)})
        </Link>
        {ORDER_STATUSES.map((status) => (
          <Link
            key={status}
            href={href({ status, page: undefined })}
            className={
              params.status === status
                ? "hf-btn hf-btn-primary py-1.5 text-sm"
                : "hf-btn hf-btn-outline py-1.5 text-sm"
            }
          >
            {STATUS_LABELS[status]} ({countFor(status)})
          </Link>
        ))}
      </nav>

      <form method="get" className="mt-4 flex flex-wrap gap-2.5">
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <div className="min-w-48 flex-1">
          <label htmlFor="order-search" className="sr-only">
            Search orders
          </label>
          <input
            id="order-search"
            name="q"
            type="search"
            defaultValue={search ?? ""}
            placeholder="Search by order number, customer name or email…"
            maxLength={60}
            className="hf-input"
          />
        </div>
        <button type="submit" className="hf-btn hf-btn-outline">
          Search
        </button>
        {search && (
          <Link href={href({ q: undefined, page: undefined })} className="hf-btn hf-btn-ghost">
            Clear
          </Link>
        )}
      </form>

      {orders.length === 0 ? (
        <div className="hf-card mt-6 p-12 text-center">
          <p className="text-sm text-slate-500">No orders match these filters.</p>
        </div>
      ) : (
        <>
          <div className="hf-card mt-5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cotton-200 bg-cotton-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-4 py-3 font-semibold">Order</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Payment</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cotton-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="transition hover:bg-cotton-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-indigo-ink-900">
                          {order.orderNumber}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDate(order.placedAt)} · {order._count.items} items
                          {order.orderType === "WHOLESALE" && (
                            <span className="ml-1.5 rounded bg-madder-100 px-1 text-[10px] font-bold text-madder-700">
                              WHOLESALE
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-indigo-ink-900">{order.user.name}</p>
                        <p className="text-xs text-slate-400">{order.user.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700">{order.paymentMethod}</p>
                        <p
                          className={`text-xs font-semibold ${
                            order.paymentStatus === "PAID"
                              ? "text-emerald-700"
                              : order.paymentStatus === "FAILED"
                                ? "text-madder-600"
                                : "text-slate-400"
                          }`}
                        >
                          {order.paymentStatus}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`hf-badge ${STATUS_STYLES[order.status] ?? ""}`}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-indigo-ink-950">
                        {formatPrice(order.total)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/orders/${order.orderNumber}`}
                          className="rounded px-2.5 py-1 text-xs font-semibold text-indigo-ink-700 transition hover:bg-indigo-ink-50"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-5 flex justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={href({ page: n > 1 ? String(n) : undefined })}
                  aria-current={n === page ? "page" : undefined}
                  className={
                    n === page
                      ? "hf-btn hf-btn-primary px-3 py-1.5 text-sm"
                      : "hf-btn hf-btn-outline px-3 py-1.5 text-sm"
                  }
                >
                  {n}
                </Link>
              ))}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
