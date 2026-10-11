import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { hashIp, type SessionUser } from "./auth";
import { getClientIp, getUserAgent } from "./ratelimit";

/**
 * Records a privileged action (who changed what, before and after).
 * Deliberately never throws: a logging failure must not undo the change the
 * staff member just made.
 */
export async function audit(params: {
  actor: Pick<SessionUser, "id" | "email" | "phone" | "name"> | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    const [ip, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);
    await db.auditLog.create({
      data: {
        actorId: params.actor?.id ?? null,
        actorLabel: params.actor ? (params.actor.email ?? params.actor.phone ?? params.actor.name) : "system",
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        before: toJson(params.before),
        after: toJson(params.after),
        ipHash: hashIp(ip),
        userAgent: userAgent?.slice(0, 300) ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write log entry", error);
  }
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return redact(JSON.parse(JSON.stringify(value))) as Prisma.InputJsonValue;
}

const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "token",
  "secret",
  "authorization",
  "cookie",
  "card",
  "cvv",
  "totp",
  "recovery",
];

/** Strips credentials before they reach the log table. */
function redact(input: unknown): unknown {
  if (Array.isArray(input)) return input.slice(0, 100).map(redact);
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      out[key] = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s)) ? "[redacted]" : redact(value);
    }
    return out;
  }
  if (typeof input === "string" && input.length > 2000) return `${input.slice(0, 2000)}…`;
  return input;
}
