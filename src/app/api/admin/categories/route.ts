import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { categorySchema, cuidSchema } from "@/lib/validators";
import { isSafeImageUrl } from "@/lib/upload";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export const POST = handler(async (request) => {
  const gate = await guard({
    auth: "admin",
    csrf: true,
    limit: { bucket: "admin-write", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const admin = gate.ctx.user!;

  const parsed = await parseJson(request, categorySchema);
  if (!parsed.ok) return parsed.response;

  const data = parsed.data;

  if (data.imageUrl && !isSafeImageUrl(data.imageUrl)) {
    return fail("Please correct the highlighted fields", 422, {
      imageUrl: "Upload the image through the picker rather than pasting a URL.",
    });
  }

  if (data.parentId) {
    const parent = await db.category.findUnique({
      where: { id: data.parentId },
      select: { id: true, parentId: true },
    });
    if (!parent) {
      return fail("Please correct the highlighted fields", 422, {
        parentId: "Choose a valid parent category.",
      });
    }
    // One level of nesting only — deeper trees make the nav unusable.
    if (parent.parentId) {
      return fail("Please correct the highlighted fields", 422, {
        parentId: "Sub-categories cannot themselves have sub-categories.",
      });
    }
  }

  try {
    const category = await db.category.create({
      data: {
        ...data,
        description: data.description || null,
        imageUrl: data.imageUrl || null,
        parentId: data.parentId || null,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
      },
      select: { id: true, name: true, slug: true },
    });

    await audit({
      userId: admin.id,
      actorEmail: admin.email,
      action: "category.create",
      entity: "Category",
      entityId: category.id,
      metadata: { name: category.name },
    });

    return ok({ category }, 201);
  } catch (error) {
    return handleSlugConflict(error);
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

  const parsed = await parseJson(
    request,
    categorySchema.extend({ id: cuidSchema }),
  );
  if (!parsed.ok) return parsed.response;

  const { id, ...data } = parsed.data;

  const existing = await db.category.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return fail("Category not found.", 404);

  if (data.imageUrl && !isSafeImageUrl(data.imageUrl)) {
    return fail("Please correct the highlighted fields", 422, {
      imageUrl: "Upload the image through the picker rather than pasting a URL.",
    });
  }

  // A category that is its own ancestor would make the nav recurse forever.
  if (data.parentId === id) {
    return fail("Please correct the highlighted fields", 422, {
      parentId: "A category cannot be its own parent.",
    });
  }

  if (data.parentId) {
    const childCount = await db.category.count({ where: { parentId: id } });
    if (childCount > 0) {
      return fail("Please correct the highlighted fields", 422, {
        parentId:
          "This category has sub-categories, so it cannot itself become a sub-category.",
      });
    }
  }

  try {
    await db.category.update({
      where: { id },
      data: {
        ...data,
        description: data.description || null,
        imageUrl: data.imageUrl || null,
        parentId: data.parentId || null,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
      },
    });

    await audit({
      userId: admin.id,
      actorEmail: admin.email,
      action: "category.update",
      entity: "Category",
      entityId: id,
      metadata: { name: data.name },
    });

    return ok({ success: true });
  } catch (error) {
    return handleSlugConflict(error);
  }
});

export const DELETE = handler(async (request) => {
  const gate = await guard({ auth: "admin", csrf: true });
  if (!gate.ok) return gate.response;

  const admin = gate.ctx.user!;

  const parsed = await parseJson(request, z.object({ id: cuidSchema }));
  if (!parsed.ok) return parsed.response;

  const category = await db.category.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      name: true,
      _count: { select: { products: true, children: true } },
    },
  });
  if (!category) return fail("Category not found.", 404);

  // Products carry a required categoryId, so deleting a populated category
  // would violate the foreign key. Fail with an actionable message instead.
  if (category._count.products > 0) {
    return fail(
      `"${category.name}" still has ${category._count.products} product${
        category._count.products === 1 ? "" : "s"
      }. Move or delete them first.`,
      409,
    );
  }
  if (category._count.children > 0) {
    return fail(
      `"${category.name}" has sub-categories. Delete those first.`,
      409,
    );
  }

  await db.category.delete({ where: { id: category.id } });

  await audit({
    userId: admin.id,
    actorEmail: admin.email,
    action: "category.delete",
    entity: "Category",
    entityId: category.id,
    metadata: { name: category.name },
  });

  return ok({ success: true });
});

function handleSlugConflict(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return fail("Please correct the highlighted fields", 422, {
      slug: "That URL slug is already taken.",
    });
  }
  throw error;
}
