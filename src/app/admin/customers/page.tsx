import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { formatIndianMobile } from "@/lib/phone";
import { formatDate } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/page-guard";
import CustomerRoleControl from "./CustomerRoleControl";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

const PER_PAGE = 25;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  const admin = await requireStaffPage("customers.view");
  const params = await searchParams;

  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q?.trim().slice(0, 80);

  const where: Prisma.UserWhereInput = { status: { not: "DELETED" } };
  if (search) {
    const digits = search.replace(/\D/g, "");
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { wholesaleProfile: { businessName: { contains: search, mode: "insensitive" } } },
      { wholesaleProfile: { gstin: { contains: search.toUpperCase() } } },
      ...(digits.length >= 6 ? [{ phone: { contains: digits.slice(-10) } }] : []),
    ];
  }
  if (params.filter === "pending-wholesale") where.wholesaleProfile = { status: "PENDING" };
  if (params.filter === "wholesale") where.wholesaleProfile = { status: "APPROVED" };
  if (params.filter === "blocked") where.status = "BLOCKED";
  if (params.filter === "staff") where.isStaff = true;

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
        status: true,
        isStaff: true,
        createdAt: true,
        wholesaleProfile: { select: { businessName: true, gstin: true, status: true } },
        _count: { select: { orders: true } },
        orders: {
          where: { status: { notIn: ["CANCELLED", "PAYMENT_FAILED", "PENDING_PAYMENT"] } },
          select: { grandTotal: true },
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
          { key: "pending-wholesale", label: "Wholesale to verify" },
          { key: "blocked", label: "Blocked" },
          { key: "staff", label: "Staff" },
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
            placeholder="Search by name, email, phone, business or GSTIN…"
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
                    <th scope="col" className="px-4 py-3 font-semibold">Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cotton-200">
                  {users.map((user) => {
                    const lifetime = user.orders.reduce((sum, o) => sum + o.grandTotal, 0);
                    return (
                      <tr key={user.id} className="transition hover:bg-cotton-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/customers/${user.id}`}
                            className="font-medium text-indigo-ink-900 hover:underline"
                          >
                            {user.name}
                          </Link>
                          {user.email && <p className="text-xs text-slate-400">{user.email}</p>}
                          {user.phone && <p className="text-xs text-slate-400">{formatIndianMobile(user.phone)}</p>}
                          <p className="text-xs text-slate-400">
                            Joined {formatDate(user.createdAt)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {user.wholesaleProfile ? (
                            <>
                              <p className="text-slate-700">{user.wholesaleProfile.businessName}</p>
                              {user.wholesaleProfile.gstin && (
                                <p className="font-mono text-xs text-slate-400">{user.wholesaleProfile.gstin}</p>
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
                            status={user.status}
                            wholesaleStatus={user.wholesaleProfile?.status ?? null}
                            isStaff={user.isStaff}
                            isSelf={user.id === admin.id}
                            canManage={can(admin, "customers.manage") && (!user.isStaff || admin.isOwner)}
                            canWholesale={can(admin, "wholesale.manage")}
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
