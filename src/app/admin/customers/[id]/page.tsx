import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { formatDate, STATUS_LABELS, STATUS_STYLES } from "@/lib/utils";

export const metadata: Metadata = { title: "Customer" };
export const dynamic = "force-dynamic";

export default async function AdminCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
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
      addresses: true,
      orders: {
        orderBy: { placedAt: "desc" },
        take: 25,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          placedAt: true,
          _count: { select: { items: true } },
        },
      },
    },
  });

  if (!user) notFound();

  const lifetime = user.orders.reduce(
    (sum, o) => (o.status === "CANCELLED" || o.status === "RETURNED" ? sum : sum + o.total),
    0,
  );

  return (
    <div>
      <Link href="/admin/customers" className="hf-link text-sm font-semibold">
        ← Customers
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
            {user.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {user.email} · joined {formatDate(user.createdAt)}
          </p>
        </div>
        <div className="flex gap-1.5">
          <span className="hf-badge text-indigo-ink-700">{user.role}</span>
          {user.role === "WHOLESALE" && (
            <span
              className={`hf-badge ${
                user.isApproved ? "text-emerald-700" : "text-turmeric-700"
              }`}
            >
              {user.isApproved ? "Approved" : "Pending"}
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Orders" value={String(user.orders.length)} />
        <Stat label="Lifetime value" value={formatPrice(lifetime)} />
        <Stat label="Saved addresses" value={String(user.addresses.length)} />
      </div>

      {user.businessName && (
        <section className="hf-card mt-6 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Business details
          </h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-400">Business name</dt>
              <dd className="font-medium text-indigo-ink-900">{user.businessName}</dd>
            </div>
            {user.gstin && (
              <div>
                <dt className="text-xs text-slate-400">GSTIN</dt>
                <dd className="font-mono font-medium text-indigo-ink-900">
                  {user.gstin}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <section className="hf-card mt-6 overflow-hidden">
        <h2 className="border-b border-cotton-200 bg-cotton-100 px-5 py-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Order history
        </h2>
        {user.orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            This customer has not placed an order yet.
          </p>
        ) : (
          <ul className="divide-y divide-cotton-200">
            {user.orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.orderNumber}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-cotton-50"
                >
                  <div>
                    <p className="font-semibold text-indigo-ink-900">
                      {order.orderNumber}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(order.placedAt)} · {order._count.items} items
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`hf-badge ${STATUS_STYLES[order.status] ?? ""}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                    <span className="font-semibold text-indigo-ink-950">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {user.addresses.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Saved addresses
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {user.addresses.map((address) => (
              <li key={address.id} className="hf-card p-4 text-sm">
                <p className="font-semibold text-indigo-ink-900">
                  {address.fullName}
                  {address.isDefault && (
                    <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                      Default
                    </span>
                  )}
                </p>
                <address className="mt-1 not-italic leading-relaxed text-slate-600">
                  {address.line1}
                  {address.line2 && `, ${address.line2}`}
                  <br />
                  {address.city}, {address.state} {address.pincode}
                  <br />
                  {address.phone}
                </address>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hf-card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-indigo-ink-950">{value}</p>
    </div>
  );
}
