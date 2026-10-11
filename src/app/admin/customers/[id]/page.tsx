import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { formatIndianMobile } from "@/lib/phone";
import { formatDate, ORDER_STATUS_LABELS as STATUS_LABELS, STATUS_STYLES } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/page-guard";
import CustomerRoleControl from "../CustomerRoleControl";

export const metadata: Metadata = { title: "Customer" };
export const dynamic = "force-dynamic";

export default async function AdminCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireStaffPage("customers.view");
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      isStaff: true,
      createdAt: true,
      lastLoginAt: true,
      wholesaleProfile: {
        select: { businessName: true, gstin: true, city: true, state: true, status: true, rejectionReason: true, createdAt: true },
      },
      addresses: true,
      orders: {
        orderBy: { placedAt: "desc" },
        take: 25,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          grandTotal: true,
          placedAt: true,
          _count: { select: { items: true } },
        },
      },
    },
  });

  if (!user) notFound();

  const NOT_SALES = new Set(["CANCELLED", "PAYMENT_FAILED", "PENDING_PAYMENT"]);
  const lifetime = user.orders.reduce((sum, o) => (NOT_SALES.has(o.status) ? sum : sum + o.grandTotal), 0);
  const business = user.wholesaleProfile;

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
            {[user.email, user.phone ? formatIndianMobile(user.phone) : null].filter(Boolean).join(" · ")} · joined{" "}
            {formatDate(user.createdAt)}
            {user.lastLoginAt && ` · last sign-in ${formatDate(user.lastLoginAt)}`}
          </p>
        </div>
        <div className="max-w-xs">
          <CustomerRoleControl
            userId={user.id}
            name={user.name}
            status={user.status}
            wholesaleStatus={business?.status ?? null}
            isStaff={user.isStaff}
            isSelf={user.id === staff.id}
            canManage={can(staff, "customers.manage") && (!user.isStaff || staff.isOwner)}
            canWholesale={can(staff, "wholesale.manage")}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Orders" value={String(user.orders.length)} />
        <Stat label="Lifetime value" value={formatPrice(lifetime)} />
        <Stat label="Saved addresses" value={String(user.addresses.length)} />
      </div>

      {business && (
        <section className="hf-card mt-6 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Business details
          </h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-400">Business name</dt>
              <dd className="font-medium text-indigo-ink-900">{business.businessName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">GSTIN</dt>
              <dd className="font-mono font-medium text-indigo-ink-900">{business.gstin ?? "Not given"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Location</dt>
              <dd className="font-medium text-indigo-ink-900">{[business.city, business.state].filter(Boolean).join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Applied</dt>
              <dd className="font-medium text-indigo-ink-900">{formatDate(business.createdAt)}</dd>
            </div>
            {business.rejectionReason && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-400">Reason given</dt>
                <dd className="text-indigo-ink-900">{business.rejectionReason}</dd>
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
                      {formatPrice(order.grandTotal)}
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
                  {formatIndianMobile(address.phone)}
                  {address.gstin && (
                    <>
                      <br />
                      GSTIN {address.gstin}
                    </>
                  )}
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
