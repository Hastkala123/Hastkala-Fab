import { guard, handler, ok } from "@/lib/api";
import { clearSessionCookie, getCurrentUser, revokeSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export const POST = handler(async () => {
  const gate = await guard({ csrf: true });
  if (!gate.ok) return gate.response;

  const user = await getCurrentUser();

  if (user) {
    // Revoke server-side as well as clearing the cookie, so a copy of the JWT
    // captured earlier cannot be replayed after logout.
    await revokeSession(user.sessionId);
    await audit({
      userId: user.id,
      actorEmail: user.email,
      action: "auth.logout",
      entity: "Session",
      entityId: user.sessionId,
    });
  }

  await clearSessionCookie();
  return ok({ success: true });
});
