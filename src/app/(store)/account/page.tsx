import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { formatDate, STATUS_LABELS, STATUS_STYLES } from "@/lib/utils";
import ProfileForm from "./ProfileForm";

export const metadata: Metadata = {
  title: "My Profile",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ pending?: string }>;
}) {
  const sessionUser = await requireUser();
  const params = await searchParams;

  const [user, stats, recentOrders] = await Promise.all([
    db.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        name: true,
        email: true,
        phone: true,
        role: true,
        businessName: true,
        gstin: true,
        isApproved: true,
        createdAt: true,
      },
    }),
    db.order.aggregate({
      where: { userId: sessionUser.id, status: { not: "CANCELLED" } },
      _count: { id: true },
      _sum: { total: true },
    }),
    db.order.findMany({
      where: { userId: sessionUser.id },
      orderBy: { placedAt: "desc" },
      take: 3,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        placedAt: true,
        _count: { select: { items: true } },
      },
    }),
  ]);

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950 sm:text-3xl">
          My profile
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Member since {formatDate(user.createdAt)}
        </p>
      </div>

      {params.pending === "1" && (
        <div
          role="status"
          className="rounded-card border border-turmeric-200 bg-turmeric-50 p-4"
        >
          <p className="text-sm font-semibold text-turmeric-900">
            Wholesale verification in progress
          </p>
          <p className="mt-1 text-sm text-turmeric-800">
            Our team is checking your business details. You will be able to see
            trade pricing as soon as the account is approved — usually within one
            working day.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Orders placed" value={String(stats._count.id)} />
        <StatCard label="Total spent" value={formatPrice(stats._sum.total ?? 0)} />
        <StatCard
          label="Account type"
          value={
            user.role === "WHOLESALE"
              ? user.isApproved
                ? "Wholesale"
                : "Wholesale (pending)"
              : "Personal"
          }
        />
      </div>

      <section className="hf-card p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-indigo-ink-950">
          Personal details
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Your email address is used to sign in and cannot be changed here — contact
          support if you need it updated.
        </p>
        <div className="mt-5">
          <ProfileForm
            initial={{
              name: user.name,
              email: user.email,
              phone: user.phone ?? "",
              role: user.role,
              businessName: user.businessName ?? "",
              gstin: user.gstin ?? "",
            }}
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">
            Recent orders
          </h2>
          <Link href="/account/orders" className="hf-link text-sm font-semibold">
            View all →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="hf-card mt-4 p-8 text-center">
            <p className="text-sm text-slate-500">
              You have not placed an order yet.
            </p>
            <Link href="/products" className="hf-btn hf-btn-primary mt-4">
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.orderNumber}`}
                  className="hf-card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-indigo-ink-300"
                >
                  <div>
                    <p className="font-semibold text-indigo-ink-900">
                      {order.orderNumber}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(order.placedAt)} · {order._count.items}{" "}
                      {order._count.items === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`hf-badge ${STATUS_STYLES[order.status] ?? ""}`}
                    >
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
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="hf-card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-indigo-ink-950">{value}</p>
    </div>
  );
}
