import "server-only";

import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AuthError, getCurrentUser, type SessionUser } from "./auth";
import { hasPermission, type Permission } from "@/server/auth/permissions";
import { TransitionError } from "@/server/orders/transitions";
import { UserError } from "@/server/errors";
import { StockError } from "@/server/inventory/stock";
import { GatewayError } from "@/server/payments/types";
import { verifyCsrf } from "./csrf";
import { getClientIp, rateLimit } from "./ratelimit";
import { isProd } from "./env";

export type ApiError = { error: string; fields?: Record<string, string> };

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, fields?: Record<string, string>) {
  return NextResponse.json<ApiError>({ error: message, fields }, { status });
}

/** Flattens a ZodError into `{ fieldName: firstMessage }` for form rendering. */
export function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/**
 * Parses a JSON body against a schema with a hard size cap.
 *
 * Without the cap, a 500 MB JSON body would be fully buffered and parsed before
 * validation ever runs — a trivial memory-exhaustion DoS.
 */
const MAX_JSON_BYTES = 256 * 1024;

export async function parseJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_JSON_BYTES) {
    return { ok: false, response: fail("Request body is too large", 413) };
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { ok: false, response: fail("Expected application/json", 415) };
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, response: fail("Could not read request body", 400) };
  }

  // content-length is client-supplied, so re-check the real byte length.
  if (Buffer.byteLength(raw, "utf8") > MAX_JSON_BYTES) {
    return { ok: false, response: fail("Request body is too large", 413) };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, response: fail("Malformed JSON", 400) };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      response: fail("Please correct the highlighted fields", 422, zodFields(result.error)),
    };
  }

  return { ok: true, data: result.data };
}

type GuardOptions = {
  /** "user" requires any signed-in account; "staff" requires a staff member. */
  auth?: "none" | "user" | "staff";
  /** With auth "staff": the permission the staff member must hold. */
  permission?: Permission;
  /** Set false only for genuinely safe idempotent endpoints. */
  csrf?: boolean;
  limit?: { bucket: string; limit: number; window: number };
};

export type GuardContext = { user: SessionUser | null };

/**
 * The single gate every mutating route passes through. Order matters:
 * CSRF is checked before authentication so a forged request is rejected
 * without revealing whether the victim's session is valid.
 */
export async function guard(
  options: GuardOptions = {},
): Promise<{ ok: true; ctx: GuardContext } | { ok: false; response: NextResponse }> {
  const { auth = "none", csrf = true, limit, permission } = options;

  if (csrf) {
    const result = await verifyCsrf();
    if (!result.ok) {
      if (!isProd) console.warn("[csrf] rejected:", result.reason);
      return { ok: false, response: fail("Invalid or missing security token", 403) };
    }
  }

  const user = await getCurrentUser();

  if (auth === "user" && !user) {
    return { ok: false, response: fail("Please sign in to continue", 401) };
  }
  if (auth === "staff" && (!user || !user.isStaff || (permission && !hasPermission(user, permission)))) {
    // Same 403 whether not-signed-in or signed-in-without-rights, so the
    // endpoint does not confirm that an admin area exists here.
    return { ok: false, response: fail("You do not have access to this resource", 403) };
  }

  if (limit) {
    const identity = user?.id ?? (await getClientIp());
    const result = await rateLimit(limit.bucket, identity, limit.limit, limit.window);
    if (!result.allowed) {
      return {
        ok: false,
        response: NextResponse.json<ApiError>(
          { error: `Too many requests. Try again in ${result.retryAfterSeconds}s.` },
          { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
        ),
      };
    }
  }

  return { ok: true, ctx: { user } };
}

/**
 * The second argument Next.js passes to every route handler. Params are
 * `unknown` so one wrapper type-checks for static and dynamic routes alike; a
 * dynamic route must validate its params with Zod before using them.
 */
export type RouteContext = { params: Promise<unknown> };

/**
 * Wraps a handler so an unexpected throw becomes a generic 500 instead of
 * leaking a stack trace, SQL fragment or file path to the client.
 */
export function handler(
  fn: (request: Request, context: RouteContext) => Promise<NextResponse>,
) {
  return async (request: Request, context: RouteContext): Promise<NextResponse> => {
    try {
      return await fn(request, context);
    } catch (error) {
      if (error instanceof AuthError) {
        return fail(error.message, error.status);
      }
      if (error instanceof ZodError) {
        return fail("Please correct the highlighted fields", 422, zodFields(error));
      }
      if (error instanceof TransitionError || error instanceof StockError) {
        return fail(error.message, 409);
      }
      if (error instanceof UserError) {
        return fail(error.message, error.status, error.fields);
      }
      if (error instanceof GatewayError) {
        console.error("[api] payment gateway error:", error.message);
        return fail("The payment service couldn't be reached. Please try again in a minute.", 502);
      }
      console.error("[api] unhandled error:", error);
      return fail("Something went wrong. Please try again.", 500);
    }
  };
}
