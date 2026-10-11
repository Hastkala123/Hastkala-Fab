import { z } from "zod";
import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { STATE_NAME_TO_CODE } from "@/lib/gstin";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { addressSchema, cuidSchema, type AddressInput } from "@/lib/validators";

export const runtime = "nodejs";

const MAX_ADDRESSES = 10;

/** The GST state code decides CGST+SGST vs IGST, so it comes from the state name. */
function toRow(data: AddressInput) {
  return { ...data, stateCode: STATE_NAME_TO_CODE[data.state]! };
}

export const POST = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "address", ...RATE_LIMITS.writeApi } });
  if (!gate.ok) return gate.response;
  const user = gate.ctx.user!;

  const parsed = await parseJson(request, addressSchema);
  if (!parsed.ok) return parsed.response;

  const address = await db.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId: user.id } });
    if (count >= MAX_ADDRESSES) return null;
    // The first saved address becomes the default.
    const isDefault = parsed.data.isDefault || count === 0;
    if (isDefault) await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    return tx.address.create({ data: { ...toRow(parsed.data), isDefault, userId: user.id } });
  });
  if (!address) return fail(`You can save up to ${MAX_ADDRESSES} addresses. Delete one first.`, 409);

  return ok({ address }, 201);
});

export const PATCH = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "address", ...RATE_LIMITS.writeApi } });
  if (!gate.ok) return gate.response;
  const user = gate.ctx.user!;

  const parsed = await parseJson(request, addressSchema.extend({ id: cuidSchema }));
  if (!parsed.ok) return parsed.response;
  const { id, ...data } = parsed.data;

  // Ownership is part of the lookup, so nobody can edit another person's address by id.
  const existing = await db.address.findFirst({ where: { id, userId: user.id }, select: { id: true, isDefault: true } });
  if (!existing) return fail("Address not found.", 404);

  const address = await db.$transaction(async (tx) => {
    if (data.isDefault) await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    // A default can't be un-set directly; choosing another one replaces it.
    return tx.address.update({
      where: { id: existing.id },
      data: { ...toRow(data), isDefault: data.isDefault || existing.isDefault },
    });
  });

  return ok({ address });
});

export const DELETE = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "address", ...RATE_LIMITS.writeApi } });
  if (!gate.ok) return gate.response;
  const user = gate.ctx.user!;

  const parsed = await parseJson(request, z.object({ id: cuidSchema }));
  if (!parsed.ok) return parsed.response;

  const address = await db.address.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true, isDefault: true },
  });
  if (!address) return fail("Address not found.", 404);

  await db.$transaction(async (tx) => {
    await tx.address.delete({ where: { id: address.id } });
    // Promote another address so checkout always has one preselected.
    if (address.isDefault) {
      const next = await tx.address.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });

  return ok({ success: true });
});
