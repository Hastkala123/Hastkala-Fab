import { z } from "zod";
import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { cuidSchema, faqSchema } from "@/lib/validators";
import { deleteFaq, saveFaq } from "@/server/content/admin";

export const runtime = "nodejs";

const gateOptions = {
  auth: "staff",
  permission: "content.manage",
  limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite },
} as const;

export const POST = handler(async (request) => {
  const gate = await guard(gateOptions);
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, faqSchema);
  if (!parsed.ok) return parsed.response;
  return ok({ faq: await saveFaq(gate.ctx.user!, parsed.data) }, 201);
});

export const PATCH = handler(async (request) => {
  const gate = await guard(gateOptions);
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, z.object({ id: cuidSchema, data: faqSchema }));
  if (!parsed.ok) return parsed.response;
  return ok({ faq: await saveFaq(gate.ctx.user!, parsed.data.data, parsed.data.id) });
});

export const DELETE = handler(async (request) => {
  const gate = await guard(gateOptions);
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, z.object({ id: cuidSchema }));
  if (!parsed.ok) return parsed.response;
  await deleteFaq(gate.ctx.user!, parsed.data.id);
  return ok({ success: true });
});
