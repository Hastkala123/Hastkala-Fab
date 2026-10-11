import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { categorySchema, cuidSchema, type CategoryInput } from "@/lib/validators";
import { audit } from "@/lib/audit";
import { isReservedSlug } from "@/lib/routes";

export const runtime = "nodejs";

const gateOptions = {
  auth: "staff",
  permission: "catalog.manage",
  limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite },
} as const;

const fieldError = (field: string, message: string) =>
  fail("Please correct the highlighted fields", 422, { [field]: message });

/** Category pages live at /{slug}, so a slug may not shadow a site page. */
async function validate(data: CategoryInput, selfId?: string) {
  if (isReservedSlug(data.slug)) return fieldError("slug", "This web address is used by another page. Choose another.");
  if (data.parentId) {
    if (data.parentId === selfId) return fieldError("parentId", "A category can't be inside itself.");
    const parent = await db.category.findUnique({ where: { id: data.parentId }, select: { parentId: true } });
    if (!parent) return fieldError("parentId", "Choose a valid parent category.");
    // One level of nesting keeps the menu usable on a phone.
    if (parent.parentId) return fieldError("parentId", "Sub-categories can't have their own sub-categories.");
    if (selfId && (await db.category.count({ where: { parentId: selfId } })) > 0) {
      return fieldError("parentId", "This category has sub-categories, so it must stay at the top level.");
    }
  }
  if (data.hsnCodeId && !(await db.hsnCode.findUnique({ where: { id: data.hsnCodeId }, select: { id: true } }))) {
    return fieldError("hsnCodeId", "Choose a valid HSN code.");
  }
  return null;
}

function slugTaken(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const POST = handler(async (request) => {
  const gate = await guard(gateOptions);
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, categorySchema);
  if (!parsed.ok) return parsed.response;

  const invalid = await validate(parsed.data);
  if (invalid) return invalid;

  try {
    const last = await db.category.aggregate({ where: { parentId: parsed.data.parentId }, _max: { position: true } });
    const category = await db.category.create({
      data: { ...parsed.data, position: (last._max.position ?? -1) + 1 },
      select: { id: true, slug: true },
    });
    await audit({ actor: gate.ctx.user, action: "category.create", entityType: "Category", entityId: category.id, after: parsed.data });
    return ok({ category }, 201);
  } catch (error) {
    if (slugTaken(error)) return fieldError("slug", "Another category already uses this web address.");
    throw error;
  }
});

export const PATCH = handler(async (request) => {
  const gate = await guard(gateOptions);
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, z.object({ id: cuidSchema, data: categorySchema }));
  if (!parsed.ok) return parsed.response;
  const { id, data } = parsed.data;

  const before = await db.category.findUnique({ where: { id } });
  if (!before) return fail("Category not found.", 404);
  const invalid = await validate(data, id);
  if (invalid) return invalid;

  try {
    const category = await db.category.update({ where: { id }, data, select: { id: true, slug: true } });
    await audit({ actor: gate.ctx.user, action: "category.update", entityType: "Category", entityId: id, before, after: data });
    return ok({ category });
  } catch (error) {
    if (slugTaken(error)) return fieldError("slug", "Another category already uses this web address.");
    throw error;
  }
});

/** Only empty categories can be deleted; otherwise hide them instead. */
export const DELETE = handler(async (request) => {
  const gate = await guard(gateOptions);
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, z.object({ id: cuidSchema }));
  if (!parsed.ok) return parsed.response;

  const category = await db.category.findUnique({
    where: { id: parsed.data.id },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!category) return fail("Category not found.", 404);
  if (category._count.products > 0 || category._count.children > 0) {
    return fail(
      `This category has ${category._count.products} product(s) and ${category._count.children} sub-categor(ies). Move them first, or switch the category off to hide it.`,
      409,
    );
  }

  await db.category.delete({ where: { id: category.id } });
  await audit({ actor: gate.ctx.user, action: "category.delete", entityType: "Category", entityId: category.id, before: category });
  return ok({ success: true });
});
