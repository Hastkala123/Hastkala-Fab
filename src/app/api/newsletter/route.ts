import { db } from "@/lib/db";
import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { newsletterSchema } from "@/lib/validators";

export const runtime = "nodejs";

export const POST = handler(async (request) => {
  const gate = await guard({
    csrf: true,
    limit: { bucket: "newsletter", ...RATE_LIMITS.newsletter },
  });
  if (!gate.ok) return gate.response;

  const parsed = await parseJson(request, newsletterSchema);
  if (!parsed.ok) return parsed.response;

  // Upsert with an unchanged update: re-subscribing an existing address is a
  // no-op that returns success, so the endpoint never reveals who is subscribed.
  await db.newsletterSubscriber.upsert({
    where: { email: parsed.data.email },
    update: { isActive: true },
    create: { email: parsed.data.email },
  });

  return ok({ success: true }, 201);
});
