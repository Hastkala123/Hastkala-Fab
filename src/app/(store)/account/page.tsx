import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUserPage } from "@/server/auth/page-guard";
import { formatPrice } from "@/lib/money";
import { formatIndianMobile } from "@/lib/phone";
import { formatDate, ORDER_STATUS_LABELS, STATUS_STYLES } from "@/lib/utils";
import ProfileForm from "./ProfileForm";

export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Orders that count as purchases (not abandoned or cancelled). */
const COUNTED = { notIn: ["CANCELLED", "PAYMENT_FAILED", "PENDING_PAYMENT"] as ("CANCELLED" | "PAYMENT_FAILED" | "PENDING_PAYMENT")[] };

export default async function AccountPage() {
  const sessionUser = await requireUserPage();

  const [user, stats, recentOrders] = await Promise.all([
    db.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        wholesaleProfile: { select: { businessName: true, gstin: true, status: true, rejectionReason: true } },
      },
    }),
    db.order.aggregate({
      where: { userId: sessionUser.id, status: COUNTED },
      _count: { id: true },
      _sum: { grandTotal: true },
    }),
    db.order.findMany({
      where: { userId: sessionUser.id },
      orderBy: { placedAt: "desc" },
      take: 3,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        grandTotal: true,
        placedAt: true,
        _count: { select: { items: true } },
      },
    }),
  ]);
  if (!user) return null;
  const wholesale = user.wholesaleProfile;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950 sm:text-3xl">My account</h1>
        <p className="mt-1 text-sm text-slate-600">Member since {formatDate(user.createdAt)}</p>
      </div>

      {wholesale && wholesale.status !== "APPROVED" && (
        <div
          role="status"
          className={`rounded-card border p-4 ${
            wholesale.status === "PENDING" ? "border-turmeric-200 bg-turmeric-50" : "border-madder-200 bg-madder-50"
          }`}
        >
          <p className="text-sm font-semibold text-indigo-ink-950">
            {wholesale.status === "PENDING" ? "Wholesale verification in progress" : "Wholesale account not active"}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {wholesale.status === "PENDING"
              ? "We're checking your business details. Trade prices appear as soon as your account is approved — usually within one working day."
              : (wholesale.rejectionReason ?? "Please contact us to activate your wholesale account.")}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Orders" value={String(stats._count.id)} />
        <StatCard label="Total spent" value={formatPrice(stats._sum.grandTotal ?? 0)} />
        <StatCard
          label="Account"
          value={wholesale ? (wholesale.status === "APPROVED" ? "Wholesale" : "Wholesale (not active)") : "Personal"}
        />
      </div>

      <section className="hf-card p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-indigo-ink-950">Personal details</h2>
        <p className="mt-1 text-sm text-slate-500">
          Your email is used to sign in. Contact us if it needs to change.
        </p>
        <div className="mt-5">
          <ProfileForm
            initial={{
              name: user.name,
              email: user.email,
              phone: user.phone ? formatIndianMobile(user.phone) : "",
            }}
          />
        </div>
        {wholesale && (
          <dl className="mt-6 grid gap-4 rounded-lg border border-cotton-300 bg-cotton-50 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Business</dt>
              <dd className="mt-0.5 font-medium text-indigo-ink-900">{wholesale.businessName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">GSTIN</dt>
              <dd className="mt-0.5 font-medium text-indigo-ink-900">{wholesale.gstin ?? "Not given"}</dd>
            </div>
            <p className="text-xs text-slate-500 sm:col-span-2">To change business details, please contact us.</p>
          </dl>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">Recent orders</h2>
          <Link href="/account/orders" className="hf-link text-sm font-semibold">
            View all →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="hf-card mt-4 p-8 text-center">
            <p className="text-sm text-slate-500">You haven&apos;t placed an order yet.</p>
            <Link href="/search" className="hf-btn hf-btn-primary mt-4">
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
                    <p className="font-semibold text-indigo-ink-900">{order.orderNumber}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(order.placedAt)} · {order._count.items} {order._count.items === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`hf-badge ${STATUS_STYLES[order.status] ?? ""}`}>
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                    <span className="font-semibold text-indigo-ink-950">{formatPrice(order.grandTotal)}</span>
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
