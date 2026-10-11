import type { Metadata } from "next";
import { db } from "@/lib/db";
import { istDateString } from "@/lib/time";
import { requireStaffPage } from "@/server/auth/page-guard";
import CouponManager from "./CouponManager";

export const metadata: Metadata = { title: "Coupons" };
export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  await requireStaffPage("marketing.manage");

  const [coupons, categories] = await Promise.all([
    db.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { categories: { select: { categoryId: true } } } }),
    db.category.findMany({ where: { parentId: null }, orderBy: { position: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">Coupons</h1>
      <p className="mt-1 text-sm text-slate-600">Discount codes shoppers apply in their bag.</p>

      <CouponManager
        categories={categories}
        coupons={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          description: c.description ?? "",
          type: c.type,
          // PERCENT is stored as a whole number; FLAT as paise.
          value: c.type === "FLAT" ? String(c.value / 100) : String(c.value),
          minOrderValue: String(c.minOrderValue / 100),
          maxDiscount: c.maxDiscount != null ? String(c.maxDiscount / 100) : "",
          usageLimit: c.usageLimit != null ? String(c.usageLimit) : "",
          perUserLimit: String(c.perUserLimit),
          usedCount: c.usedCount,
          isActive: c.isActive,
          audience: c.audience,
          firstOrderOnly: c.firstOrderOnly,
          startsAt: c.startsAt > c.createdAt ? istDateString(c.startsAt) : "",
          endsAt: c.endsAt ? istDateString(c.endsAt) : "",
          categoryIds: c.categories.map((x) => x.categoryId),
        }))}
      />
    </div>
  );
}
