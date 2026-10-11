import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { updateProfileSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export const PATCH = handler(async (request) => {
  const gate = await guard({
    auth: "user",
    csrf: true,
    limit: { bucket: "profile", ...RATE_LIMITS.writeApi },
  });
  if (!gate.ok) return gate.response;

  const user = gate.ctx.user!;

  const parsed = await parseJson(request, updateProfileSchema);
  if (!parsed.ok) return parsed.response;

  const { name, phone, businessName, gstin } = parsed.data;

  if (phone) {
    const taken = await db.user.findFirst({
      where: { phone, id: { not: user.id } },
      select: { id: true },
    });
    if (taken) {
      return fail("Please correct the highlighted fields", 422, {
        phone: "This mobile number is already in use.",
      });
    }
  }

  // Note the omissions: role, isApproved, email and passwordHash are NOT
  // updatable here. A user must never be able to promote themselves by
  // including extra keys in the request body.
  await db.user.update({
    where: { id: user.id },
    data: {
      name,
      phone: phone || null,
      businessName: businessName || null,
      gstin: gstin || null,
    },
  });

  await audit({
    userId: user.id,
    actorEmail: user.email,
    action: "user.profile.update",
    entity: "User",
    entityId: user.id,
  });

  return ok({ success: true });
});
