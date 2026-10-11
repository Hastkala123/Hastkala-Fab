import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { createSession, hashIp, hashPassword, setSessionCookie } from "@/lib/auth";
import { getClientIp, getUserAgent, RATE_LIMITS } from "@/lib/ratelimit";
import { signupSchema } from "@/lib/validators";
import { mergeGuestCart } from "@/server/cart";

export const runtime = "nodejs";

/** Bump when the privacy notice changes, so consent records say which version was agreed. */
const PRIVACY_NOTICE_VERSION = "2026-10";

const accountExists = () =>
  fail("An account with these details already exists. Try signing in instead.", 409, {
    email: "If this is your email, sign in or reset your password.",
  });

export const POST = handler(async (request) => {
  const gate = await guard({ limit: { bucket: "signup", ...RATE_LIMITS.signup } });
  if (!gate.ok) return gate.response;

  const parsed = await parseJson(request, signupSchema);
  if (!parsed.ok) return parsed.response;
  const { name, email, phone, password, accountType, businessName, gstin, city, marketingOptIn } = parsed.data;

  const [emailTaken, phoneTaken] = await Promise.all([
    db.user.findUnique({ where: { email }, select: { id: true } }),
    phone ? db.user.findUnique({ where: { phone }, select: { id: true } }) : Promise.resolve(null),
  ]);
  if (emailTaken) return accountExists();
  if (phoneTaken) {
    return fail("Please correct the highlighted fields", 422, { phone: "This mobile number is already registered." });
  }

  const passwordHash = await hashPassword(password);
  const ip = await getClientIp();

  let userId: string;
  try {
    const user = await db.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        // Everyone starts as a retail customer; staff approval of the
        // business profile switches the account to wholesale prices.
        customerType: "RETAIL",
        wholesaleProfile:
          accountType === "WHOLESALE"
            ? { create: { businessName: businessName!, gstin, city, status: "PENDING" } }
            : undefined,
        consents: marketingOptIn
          ? {
              create: {
                purpose: "MARKETING_EMAIL",
                granted: true,
                source: "signup_form",
                noticeVersion: PRIVACY_NOTICE_VERSION,
                ipHash: hashIp(ip),
              },
            }
          : undefined,
      },
      select: { id: true },
    });
    userId = user.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return accountExists();
    throw error;
  }

  const token = await createSession(userId, { ip, userAgent: await getUserAgent() });
  await setSessionCookie(token);
  await mergeGuestCart(userId);

  return ok({ requiresApproval: accountType === "WHOLESALE" }, 201);
});
