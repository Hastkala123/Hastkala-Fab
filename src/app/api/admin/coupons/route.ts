import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { couponSchema, cuidSchema, type CouponInput } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const gateOptions = {
  auth: "staff",
  permission: "marketing.manage",
  limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite },
} as const;

function toData({ categoryIds, startsAt, ...rest }: CouponInput) {
  return { ...rest, startsAt: startsAt ?? new Date(), categoryIds };
}

const codeTaken = () => fail("Please correct the highlighted fields", 409, { code: "This code already exists." });

export const POST = handler(async (request) => {
  const gate = await guard(gateOptions);
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, couponSchema);
  if (!parsed.ok) return parsed.response;
  const { categoryIds, ...data } = toData(parsed.data);

  try {
    const coupon = await db.coupon.create({
      data: { ...data, categories: { create: categoryIds.map((categoryId) => ({ categoryId })) } },
      select: { id: true, code: true },
    });
    await audit({ actor: gate.ctx.user, action: "coupon.create", entityType: "Coupon", entityId: coupon.id, after: parsed.data });
    return ok({ coupon }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return codeTaken();
    throw error;
  }
});

export const PATCH = handler(async (request) => {
  const gate = await guard(gateOptions);
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, z.object({ id: cuidSchema, data: couponSchema }));
  if (!parsed.ok) return parsed.response;
  const { id } = parsed.data;
  const { categoryIds, ...data } = toData(parsed.data.data);

  const before = await db.coupon.findUnique({ where: { id }, include: { categories: true } });
  if (!before) return fail("Coupon not found.", 404);

  try {
    await db.$transaction([
      db.couponCategory.deleteMany({ where: { couponId: id } }),
      db.coupon.update({
        where: { id },
        // usedCount is never editable: it is counted by checkout.
        data: { ...data, categories: { create: categoryIds.map((categoryId) => ({ categoryId })) } },
      }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return codeTaken();
    throw error;
  }
  await audit({ actor: gate.ctx.user, action: "coupon.update", entityType: "Coupon", entityId: id, before, after: parsed.data.data });
  return ok({ success: true });
});

/** Used coupons are switched off (orders refer to them); unused ones are deleted. */
export const DELETE = handler(async (request) => {
  const gate = await guard(gateOptions);
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, z.object({ id: cuidSchema }));
  if (!parsed.ok) return parsed.response;

  const coupon = await db.coupon.findUnique({
    where: { id: parsed.data.id },
    include: { _count: { select: { redemptions: true } } },
  });
  if (!coupon) return fail("Coupon not found.", 404);

  if (coupon._count.redemptions > 0) {
    await db.coupon.update({ where: { id: coupon.id }, data: { isActive: false } });
    await audit({ actor: gate.ctx.user, action: "coupon.deactivate", entityType: "Coupon", entityId: coupon.id });
    return ok({ deleted: false, message: "This coupon has been used, so it was switched off instead of deleted." });
  }
  await db.coupon.delete({ where: { id: coupon.id } });
  await audit({ actor: gate.ctx.user, action: "coupon.delete", entityType: "Coupon", entityId: coupon.id, before: coupon });
  return ok({ deleted: true });
});
