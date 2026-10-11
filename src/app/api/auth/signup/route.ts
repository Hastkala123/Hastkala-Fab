import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { createSession, hashPassword, setSessionCookie } from "@/lib/auth";
import { mergeGuestCart } from "@/lib/cart";
import { getClientIp, getUserAgent, RATE_LIMITS } from "@/lib/ratelimit";
import { signupSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export const POST = handler(async (request) => {
  const gate = await guard({
    csrf: true,
    limit: { bucket: "signup", ...RATE_LIMITS.signup },
  });
  if (!gate.ok) return gate.response;

  const parsed = await parseJson(request, signupSchema);
  if (!parsed.ok) return parsed.response;

  const { name, email, phone, password, accountType, businessName, gstin } = parsed.data;

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    // Deliberately does not say "this email is registered" in a way that
    // differs in status or timing from other validation failures — but we do
    // need to tell a legitimate user something actionable, so we point them at
    // sign-in rather than confirming account existence outright.
    return fail("An account with these details could not be created. Try signing in instead.", 409, {
      email: "This email cannot be used. If it is yours, sign in or reset your password.",
    });
  }

  if (phone) {
    const phoneTaken = await db.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (phoneTaken) {
      return fail("Please correct the highlighted fields", 422, {
        phone: "This mobile number is already registered.",
      });
    }
  }

  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      passwordHash,
      role: accountType,
      businessName: businessName || null,
      gstin: gstin || null,
      // Wholesale accounts stay unapproved until an admin verifies the GSTIN,
      // so trade pricing is never exposed on self-declaration alone.
      isApproved: accountType === "CUSTOMER",
    },
    select: { id: true, email: true, name: true, role: true, isApproved: true },
  });

  const [ip, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);
  const token = await createSession(user.id, { ip, userAgent });
  await setSessionCookie(token);

  await mergeGuestCart({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "CUSTOMER" | "WHOLESALE",
    avatarUrl: null,
    isApproved: user.isApproved,
    sessionId: "",
  });

  await audit({
    userId: user.id,
    actorEmail: user.email,
    action: "user.signup",
    entity: "User",
    entityId: user.id,
    metadata: { role: user.role },
  });

  return ok(
    {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      requiresApproval: accountType === "WHOLESALE",
    },
    201,
  );
});
