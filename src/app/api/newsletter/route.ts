import { db } from "@/lib/db";
import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { newsletterSchema } from "@/lib/validators";

export const runtime = "nodejs";

/**
 * Newsletter sign-up. Addresses start PENDING until the confirmation email
 * (double opt-in, milestone M6) is clicked. The response is the same whether
 * or not the address was already on the list, so nobody can check who is.
 */
export const POST = handler(async (request) => {
  const gate = await guard({ limit: { bucket: "newsletter", ...RATE_LIMITS.newsletter } });
  if (!gate.ok) return gate.response;

  const parsed = await parseJson(request, newsletterSchema);
  if (!parsed.ok) return parsed.response;

  await db.newsletterSubscriber.upsert({
    where: { email: parsed.data.email },
    create: { email: parsed.data.email, status: "PENDING", source: "footer" },
    update: {},
  });

  return ok({ success: true }, 201);
});
