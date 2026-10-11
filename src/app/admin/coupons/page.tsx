import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import CouponManager from "./CouponManager";

export const metadata: Metadata = { title: "Coupons" };
export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  await requireAdmin();

  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
        Coupons
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Discount codes customers can apply at checkout.
      </p>

      <CouponManager
        coupons={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          description: c.description ?? "",
          type: c.type,
          // PERCENT is stored as a whole number; FLAT as paise.
          value: c.type === "PERCENT" ? String(c.value) : String(c.value / 100),
          minOrderValue: String(c.minOrderValue / 100),
          maxDiscount: c.maxDiscount != null ? String(c.maxDiscount / 100) : "",
          usageLimit: c.usageLimit != null ? String(c.usageLimit) : "",
          perUserLimit: String(c.perUserLimit),
          usedCount: c.usedCount,
          isActive: c.isActive,
          appliesTo: c.appliesTo,
          expiresAt: c.expiresAt ? c.expiresAt.toISOString().slice(0, 10) : "",
        }))}
      />
    </div>
  );
}
