import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { cuidSchema, productSchema } from "@/lib/validators";
import { isSafeImageUrl } from "@/lib/upload";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** Rejects any image URL that is not a file we ourselves stored. */
function sanitiseImages(images: { url: string; alt?: string }[]) {
  return images.filter((image) => isSafeImageUrl(image.url));
}

/** POST — create a product. */
export const POST = handler(async (request) => {
  const gate = await guard({
    auth: "admin",
    csrf: true,
    limit: { bucket: "admin-write", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const admin = gate.ctx.user!;

  const parsed = await parseJson(request, productSchema);
  if (!parsed.ok) return parsed.response;

  const { images, variants, ...data } = parsed.data;

  const category = await db.category.findUnique({
    where: { id: data.categoryId },
    select: { id: true },
  });
  if (!category) {
    return fail("Please correct the highlighted fields", 422, {
      categoryId: "Choose a valid category.",
    });
  }

  const safeImages = sanitiseImages(images);
  if (images.length > 0 && safeImages.length !== images.length) {
    return fail("One or more images were rejected. Re-upload them and try again.", 422);
  }

  try {
    const product = await db.product.create({
      data: {
        ...data,
        shortDesc: data.shortDesc || null,
        fabric: data.fabric || null,
        printType: data.printType || null,
        workType: data.workType || null,
        occasion: data.occasion || null,
        washCare: data.washCare || null,
        origin: data.origin || null,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
        keywords: data.keywords || null,
        images: {
          create: safeImages.map((image, index) => ({
            url: image.url,
            alt: image.alt || data.title,
            position: index,
          })),
        },
        variants: {
          create: variants.map((variant) => ({
            size: variant.size || null,
            color: variant.color || null,
            sku: variant.sku,
            stock: variant.stock,
            priceDelta: variant.priceDelta,
          })),
        },
      },
      select: { id: true, slug: true, title: true },
    });

    await audit({
      userId: admin.id,
      actorEmail: admin.email,
      action: "product.create",
      entity: "Product",
      entityId: product.id,
      metadata: { title: product.title, slug: product.slug },
    });

    return ok({ product }, 201);
  } catch (error) {
    return handleUniqueViolation(error);
  }
});

/** PATCH — update a product, replacing its images and variants wholesale. */
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
    z.object({ id: cuidSchema, data: productSchema }),
  );
  if (!parsed.ok) return parsed.response;

  const { id } = parsed.data;
  const { images, variants, ...data } = parsed.data.data;

  const existing = await db.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return fail("Product not found.", 404);

  const safeImages = sanitiseImages(images);
  if (images.length > 0 && safeImages.length !== images.length) {
    return fail("One or more images were rejected. Re-upload them and try again.", 422);
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: id } });

      // Variants referenced by an existing order line cannot be deleted
      // (the FK is SetNull, but keeping them preserves order history), so we
      // delete only those that have never been ordered.
      const orderedVariantIds = (
        await tx.orderItem.findMany({
          where: { variantId: { not: null }, product: { id } },
          select: { variantId: true },
          distinct: ["variantId"],
        })
      )
        .map((row) => row.variantId)
        .filter((v): v is string => v !== null);

      await tx.productVariant.deleteMany({
        where: { productId: id, id: { notIn: orderedVariantIds } },
      });

      await tx.product.update({
        where: { id },
        data: {
          ...data,
          shortDesc: data.shortDesc || null,
          fabric: data.fabric || null,
          printType: data.printType || null,
          workType: data.workType || null,
          occasion: data.occasion || null,
          washCare: data.washCare || null,
          origin: data.origin || null,
          metaTitle: data.metaTitle || null,
          metaDescription: data.metaDescription || null,
          keywords: data.keywords || null,
          images: {
            create: safeImages.map((image, index) => ({
              url: image.url,
              alt: image.alt || data.title,
              position: index,
            })),
          },
        },
      });

      for (const variant of variants) {
        await tx.productVariant.upsert({
          where: { sku: variant.sku },
          update: {
            size: variant.size || null,
            color: variant.color || null,
            stock: variant.stock,
            priceDelta: variant.priceDelta,
            productId: id,
          },
          create: {
            productId: id,
            size: variant.size || null,
            color: variant.color || null,
            sku: variant.sku,
            stock: variant.stock,
            priceDelta: variant.priceDelta,
          },
        });
      }
    });

    await audit({
      userId: admin.id,
      actorEmail: admin.email,
      action: "product.update",
      entity: "Product",
      entityId: id,
      metadata: { title: data.title },
    });

    return ok({ success: true });
  } catch (error) {
    return handleUniqueViolation(error);
  }
});

/** DELETE — soft-delete by default; hard-delete only when never ordered. */
export const DELETE = handler(async (request) => {
  const gate = await guard({ auth: "admin", csrf: true });
  if (!gate.ok) return gate.response;

  const admin = gate.ctx.user!;

  const parsed = await parseJson(request, z.object({ id: cuidSchema }));
  if (!parsed.ok) return parsed.response;

  const product = await db.product.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, title: true, _count: { select: { orderItems: true } } },
  });
  if (!product) return fail("Product not found.", 404);

  if (product._count.orderItems > 0) {
    // Deleting would orphan historical invoices, so we deactivate instead.
    await db.product.update({
      where: { id: product.id },
      data: { isActive: false, isFeatured: false },
    });

    await audit({
      userId: admin.id,
      actorEmail: admin.email,
      action: "product.deactivate",
      entity: "Product",
      entityId: product.id,
      metadata: { title: product.title, reason: "has order history" },
    });

    return ok({
      success: true,
      softDeleted: true,
      message:
        "This product appears in past orders, so it has been hidden from the store rather than deleted.",
    });
  }

  await db.product.delete({ where: { id: product.id } });

  await audit({
    userId: admin.id,
    actorEmail: admin.email,
    action: "product.delete",
    entity: "Product",
    entityId: product.id,
    metadata: { title: product.title },
  });

  return ok({ success: true, softDeleted: false });
});

/** Turns Prisma's P2002 into a field-level message instead of a 500. */
function handleUniqueViolation(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = (error.meta?.target as string[] | undefined)?.join(", ") ?? "field";
    const field = target.includes("slug")
      ? "slug"
      : target.includes("sku")
        ? "sku"
        : target;
    return fail("Please correct the highlighted fields", 422, {
      [field]: `That ${field} is already in use. Choose another.`,
    });
  }
  throw error;
}
