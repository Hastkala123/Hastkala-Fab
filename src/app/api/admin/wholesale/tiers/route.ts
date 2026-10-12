import { z } from "zod";
import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { cuidSchema, priceTierSchema } from "@/lib/validators";
import { deleteTier, saveTier } from "@/server/wholesale/admin";

export const runtime = "nodejs";

const gateOptions = {
  auth: "staff" as const,
  permission: "wholesale.manage" as const,
  limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite },
};

export const POST = handler(async (request) => {
  const gate = await guard(gateOptions);
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, priceTierSchema);
  if (!parsed.ok) return parsed.response;
  return ok({ tier: await saveTier(gate.ctx.user!, parsed.data) }, 201);
});

export const PATCH = handler(async (request) => {
  const gate = await guard(gateOptions);
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, priceTierSchema.extend({ id: cuidSchema }));
  if (!parsed.ok) return parsed.response;
  const { id, ...data } = parsed.data;
  return ok({ tier: await saveTier(gate.ctx.user!, data, id) });
});

export const DELETE = handler(async (request) => {
  const gate = await guard(gateOptions);
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, z.object({ id: cuidSchema }));
  if (!parsed.ok) return parsed.response;
  await deleteTier(gate.ctx.user!, parsed.data.id);
  return ok({ success: true });
});
