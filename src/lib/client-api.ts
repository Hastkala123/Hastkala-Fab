"use client";

/**
 * Client-side fetch wrapper.
 *
 * Every mutating request must carry the CSRF token from the `hf_csrf` cookie in
 * the `x-csrf-token` header — the server rejects the request otherwise. Doing it
 * here means no individual component can forget.
 */

const CSRF_COOKIE = "hf_csrf";

function readCsrfToken(): string {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : "";
}

/**
 * Sends the request with the current token. If the token cookie had expired
 * (a tab left open for a day), the 403 response carries a fresh cookie from
 * the proxy, so the request is sent once more with it.
 */
async function sendWithCsrf(url: string, init: RequestInit & { headers: Record<string, string> }): Promise<Response> {
  const token = readCsrfToken();
  const response = await fetch(url, { ...init, headers: { ...init.headers, "x-csrf-token": token } });
  const fresh = readCsrfToken();
  if (response.status !== 403 || !fresh || fresh === token) return response;
  return fetch(url, { ...init, headers: { ...init.headers, "x-csrf-token": fresh } });
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: Record<string, string>; status: number };

export async function apiRequest<T = unknown>(
  url: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<ApiResult<T>> {
  const { method = "POST", body, signal } = options;

  try {
    const response = await sendWithCsrf(url, {
      method,
      signal,
      headers: { "Content-Type": "application/json" },
      // Never send our cookies to a third-party origin.
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    let payload: unknown = null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      payload = await response.json().catch(() => null);
    }

    if (!response.ok) {
      const err = payload as { error?: string; fields?: Record<string, string> } | null;
      return {
        ok: false,
        status: response.status,
        error: err?.error ?? "Something went wrong. Please try again.",
        fields: err?.fields,
      };
    }

    return { ok: true, data: payload as T };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, status: 0, error: "Request cancelled" };
    }
    return {
      ok: false,
      status: 0,
      error: "Network error. Check your connection and try again.",
    };
  }
}

/** Multipart variant for image uploads — no JSON Content-Type header. */
export async function apiUpload<T = unknown>(
  url: string,
  formData: FormData,
): Promise<ApiResult<T>> {
  try {
    const response = await sendWithCsrf(url, {
      method: "POST",
      headers: {},
      credentials: "same-origin",
      body: formData,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const err = payload as { error?: string } | null;
      return {
        ok: false,
        status: response.status,
        error: err?.error ?? "Upload failed",
      };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, status: 0, error: "Upload failed. Check your connection." };
  }
}
