import { guard, handler, ok } from "@/lib/api";
import { clearSessionCookie, getCurrentUser, revokeSession } from "@/lib/auth";

export const runtime = "nodejs";

export const POST = handler(async () => {
  const gate = await guard();
  if (!gate.ok) return gate.response;

  const user = await getCurrentUser();
  // Revoke server-side as well as clearing the cookie, so a copy of the token
  // captured earlier can't be replayed after logout.
  if (user) await revokeSession(user.sessionId);

  await clearSessionCookie();
  return ok({ success: true });
});
