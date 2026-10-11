import "server-only";

import { db } from "./db";
import { hashIp } from "./auth";
import { getClientIp } from "./ratelimit";

/**
 * Records a privileged action. Deliberately never throws: a logging failure
 * must not roll back the business operation the admin just performed.
 */
export async function audit(params: {
  userId?: string | null;
  actorEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const ip = await getClientIp();
    await db.auditLog.create({
      data: {
        userId: params.userId ?? null,
        actorEmail: params.actorEmail ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        metadata: params.metadata ? JSON.stringify(redact(params.metadata)) : null,
        ipHash: hashIp(ip),
      },
    });
  } catch (error) {
    console.error("[audit] failed to write log entry", error);
  }
}

const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "newpassword",
  "currentpassword",
  "confirmpassword",
  "token",
  "secret",
  "authorization",
  "cookie",
  "card",
  "cvv",
  "gstin",
];

/** Strips credentials before they reach the log table. */
function redact(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
      out[key] = "[redacted]";
    } else if (typeof value === "string" && value.length > 300) {
      out[key] = `${value.slice(0, 300)}…`;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = redact(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}
