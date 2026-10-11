import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { updateProfileSchema } from "@/lib/validators";

export const runtime = "nodejs";

export const PATCH = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "profile", ...RATE_LIMITS.writeApi } });
  if (!gate.ok) return gate.response;
  const user = gate.ctx.user!;

  const parsed = await parseJson(request, updateProfileSchema);
  if (!parsed.ok) return parsed.response;
  const { name, phone } = parsed.data;

  if (phone && phone !== user.phone) {
    const taken = await db.user.findFirst({ where: { phone, id: { not: user.id } }, select: { id: true } });
    if (taken) return fail("Please correct the highlighted fields", 422, { phone: "This mobile number is already in use." });
  }

  // Only these two fields. Staff flags, customer type, email and password are
  // never writable here, whatever extra keys a request carries.
  await db.user.update({
    where: { id: user.id },
    data: { name, phone, ...(phone !== user.phone ? { phoneVerifiedAt: null } : {}) },
  });

  return ok({ success: true });
});
