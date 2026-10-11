import { z } from "zod";
import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { cuidSchema, productSchema } from "@/lib/validators";
import { archiveProduct, saveProduct } from "@/server/catalog/admin";

export const runtime = "nodejs";

const gateOptions = {
  auth: "staff",
  permission: "catalog.manage",
  limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite },
} as const;

/** Create a product with its photos, sizes/colours, stock and prices. */
export const POST = handler(async (request) => {
  const gate = await guard(gateOptions);
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, productSchema);
  if (!parsed.ok) return parsed.response;

  const product = await saveProduct(parsed.data, gate.ctx.user!);
  return ok({ product }, 201);
});

/** Save every change to an existing product in one go. */
export const PATCH = handler(async (request) => {
  const gate = await guard(gateOptions);
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, z.object({ id: cuidSchema, data: productSchema }));
  if (!parsed.ok) return parsed.response;

  const product = await saveProduct(parsed.data.data, gate.ctx.user!, parsed.data.id);
  return ok({ product });
});

/** Archive (hide) a product. Orders and invoices keep referring to it. */
export const DELETE = handler(async (request) => {
  const gate = await guard(gateOptions);
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, z.object({ id: cuidSchema }));
  if (!parsed.ok) return parsed.response;

  await archiveProduct(parsed.data.id, gate.ctx.user!);
  return ok({ archived: true, message: "Product archived. It's hidden from the shop; set it to Active to bring it back." });
});
