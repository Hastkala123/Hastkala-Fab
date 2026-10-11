import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { couponSchema, cuidSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

function normalise(data: z.infer<typeof couponSchema>) {
  return {
    code: data.code,
    description: data.description || null,
    type: data.type,
    // PERCENT stores a whole-number percentage; FLAT stores paise.
    value: data.type === "PERCENT" ? Math.round(data.value) : Math.round(data.value * 100),
    minOrderValue: data.minOrderValue,
    maxDiscount: data.maxDiscount ?? null,
    usageLimit: data.usageLimit ?? null,
    perUserLimit: data.perUserLimit,
    isActive: data.isActive,
    appliesTo: data.appliesTo,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
  };
}

export const POST = handler(async (request) => {
  const gate = await guard({
    auth: "admin",
    csrf: true,
    limit: { bucket: "admin-write", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const admin = gate.ctx.user!;

  const parsed = await parseJson(request, couponSchema);
  if (!parsed.ok) return parsed.response;

  const data = normalise(parsed.data);

  if (data.expiresAt && Number.isNaN(data.expiresAt.getTime())) {
    return fail("Please correct the highlighted fields", 422, {
      expiresAt: "Enter a valid expiry date.",
    });
  }

  try {
    const coupon = await db.coupon.create({ data, select: { id: true, code: true } });

    await audit({
      userId: admin.id,
      actorEmail: admin.email,
      action: "coupon.create",
      entity: "Coupon",
      entityId: coupon.id,
      metadata: { code: coupon.code },
    });

    return ok({ coupon }, 201);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return fail("Please correct the highlighted fields", 422, {
        code: "That coupon code already exists.",
      });
    }
    throw error;
  }
});

export const PATCH = handler(async (request) => {
  const gate = await guard({
    auth: "admin",
    csrf: true,
    limit: { bucket: "admin-write", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const admin = gate.ctx.user!;

  const parsed = await parseJson(request, couponSchema.extend({ id: cuidSchema }));
  if (!parsed.ok) return parsed.response;

  const { id, ...rest } = parsed.data;

  const existing = await db.coupon.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return fail("Coupon not found.", 404);

  await db.coupon.update({ where: { id }, data: normalise(rest) });

  await audit({
    userId: admin.id,
    actorEmail: admin.email,
    action: "coupon.update",
    entity: "Coupon",
    entityId: id,
    metadata: { code: rest.code },
  });

  return ok({ success: true });
});

export const DELETE = handler(async (request) => {
  const gate = await guard({ auth: "admin", csrf: true });
  if (!gate.ok) return gate.response;

  const admin = gate.ctx.user!;

  const parsed = await parseJson(request, z.object({ id: cuidSchema }));
  if (!parsed.ok) return parsed.response;

  const coupon = await db.coupon.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, code: true, usedCount: true },
  });
  if (!coupon) return fail("Coupon not found.", 404);

  // A redeemed coupon is referenced by order records, so it is deactivated
  // rather than deleted to keep those orders explicable.
  if (coupon.usedCount > 0) {
    await db.coupon.update({ where: { id: coupon.id }, data: { isActive: false } });
    return ok({
      success: true,
      softDeleted: true,
      message: "This coupon has been used on real orders, so it was deactivated instead of deleted.",
    });
  }

  await db.coupon.delete({ where: { id: coupon.id } });

  await audit({
    userId: admin.id,
    actorEmail: admin.email,
    action: "coupon.delete",
    entity: "Coupon",
    entityId: coupon.id,
    metadata: { code: coupon.code },
  });

  return ok({ success: true, softDeleted: false });
});
