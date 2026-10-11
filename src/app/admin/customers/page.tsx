import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import CustomerRoleControl from "./CustomerRoleControl";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

const PER_PAGE = 25;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;

  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q?.trim().slice(0, 80);

  const where: Prisma.UserWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { businessName: { contains: search } },
    ];
  }
  if (params.filter === "pending-wholesale") {
    where.role = "WHOLESALE";
    where.isApproved = false;
  }
  if (params.filter === "wholesale") where.role = "WHOLESALE";
  if (params.filter === "admins") where.role = { in: ["ADMIN", "SUPERADMIN"] };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isApproved: true,
        businessName: true,
        gstin: true,
        createdAt: true,
        _count: { select: { orders: true } },
        orders: {
          where: { status: { notIn: ["CANCELLED", "RETURNED"] } },
          select: { total: true },
        },
      },
    }),
    db.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  function href(overrides: Record<string, string | undefined>) {
    const search = new URLSearchParams();
    const merged = { q: params.q, filter: params.filter, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) search.set(key, value);
    }
    const qs = search.toString();
    return qs ? `/admin/customers?${qs}` : "/admin/customers";
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
        Customers
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {total} {total === 1 ? "account" : "accounts"}
      </p>

      <nav aria-label="Filter customers" className="mt-5 flex flex-wrap gap-1.5">
        {[
          { key: undefined, label: "All" },
          { key: "wholesale", label: "Wholesale" },
          { key: "pending-wholesale", label: "Pending verification" },
          { key: "admins", label: "Admins" },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={href({ filter: tab.key, page: undefined })}
            className={
              params.filter === tab.key || (!params.filter && !tab.key)
                ? "hf-btn hf-btn-primary py-1.5 text-sm"
                : "hf-btn hf-btn-outline py-1.5 text-sm"
            }
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <form method="get" className="mt-4 flex flex-wrap gap-2.5">
        {params.filter && <input type="hidden" name="filter" value={params.filter} />}
        <div className="min-w-48 flex-1">
          <label htmlFor="customer-search" className="sr-only">
            Search customers
          </label>
          <input
            id="customer-search"
            name="q"
            type="search"
            defaultValue={search ?? ""}
            placeholder="Search by name, email or business…"
            maxLength={80}
            className="hf-input"
          />
        </div>
        <button type="submit" className="hf-btn hf-btn-outline">
          Search
        </button>
      </form>

      {users.length === 0 ? (
        <div className="hf-card mt-6 p-12 text-center">
          <p className="text-sm text-slate-500">No accounts match these filters.</p>
        </div>
      ) : (
        <>
          <div className="hf-card mt-5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cotton-200 bg-cotton-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Business</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Orders</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Role &amp; access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cotton-200">
                  {users.map((user) => {
                    const lifetime = user.orders.reduce((sum, o) => sum + o.total, 0);
                    return (
                      <tr key={user.id} className="transition hover:bg-cotton-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/customers/${user.id}`}
                            className="font-medium text-indigo-ink-900 hover:underline"
                          >
                            {user.name}
                          </Link>
                          <p className="text-xs text-slate-400">{user.email}</p>
                          {user.phone && (
                            <p className="text-xs text-slate-400">{user.phone}</p>
                          )}
                          <p className="text-xs text-slate-400">
                            Joined {formatDate(user.createdAt)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {user.businessName ? (
                            <>
                              <p className="text-slate-700">{user.businessName}</p>
                              {user.gstin && (
                                <p className="font-mono text-xs text-slate-400">
                                  {user.gstin}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-indigo-ink-900">
                            {user._count.orders}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatPrice(lifetime)} lifetime
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <CustomerRoleControl
                            userId={user.id}
                            name={user.name}
                            role={user.role}
                            isApproved={user.isApproved}
                            canManageAdmins={admin.role === "SUPERADMIN"}
                            isSelf={user.id === admin.id}
                          />
                        </td>
                      </tr>
                    );
                  })}
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
