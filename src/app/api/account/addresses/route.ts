import { z } from "zod";
import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { addressSchema, cuidSchema } from "@/lib/validators";

export const runtime = "nodejs";

const MAX_ADDRESSES = 10;

export const POST = handler(async (request) => {
  const gate = await guard({
    auth: "user",
    csrf: true,
    limit: { bucket: "address", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const user = gate.ctx.user!;

  const parsed = await parseJson(request, addressSchema);
  if (!parsed.ok) return parsed.response;

  const count = await db.address.count({ where: { userId: user.id } });
  if (count >= MAX_ADDRESSES) {
    return fail(`You can save up to ${MAX_ADDRESSES} addresses. Delete one first.`, 409);
  }

  // The first address a user saves becomes their default automatically.
  const isDefault = parsed.data.isDefault || count === 0;

  if (isDefault) {
    await db.address.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
  }

  const address = await db.address.create({
    data: {
      ...parsed.data,
      line2: parsed.data.line2 || null,
      isDefault,
      userId: user.id,
    },
  });

  return ok({ address }, 201);
});

export const PATCH = handler(async (request) => {
  const gate = await guard({
    auth: "user",
    csrf: true,
    limit: { bucket: "address", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const user = gate.ctx.user!;

  const parsed = await parseJson(
    request,
    addressSchema.extend({ id: cuidSchema }),
  );
  if (!parsed.ok) return parsed.response;

  const { id, ...data } = parsed.data;

  // Ownership check before any write — without it, any signed-in user could
  // overwrite anyone's address by id.
  const existing = await db.address.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) return fail("Address not found.", 404);

  if (data.isDefault) {
    await db.address.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
  }

  const address = await db.address.update({
    where: { id: existing.id },
    data: { ...data, line2: data.line2 || null },
  });

  return ok({ address });
});

export const DELETE = handler(async (request) => {
  const gate = await guard({ auth: "user", csrf: true });
  if (!gate.ok) return gate.response;

  const user = gate.ctx.user!;

  const parsed = await parseJson(request, z.object({ id: cuidSchema }));
  if (!parsed.ok) return parsed.response;

  const address = await db.address.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true, isDefault: true },
  });
  if (!address) return fail("Address not found.", 404);

  await db.address.delete({ where: { id: address.id } });

  // Promote another address to default so checkout always has one preselected.
  if (address.isDefault) {
    const next = await db.address.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (next) {
      await db.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  return ok({ success: true });
});
