import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/routes";
import { clientIpFrom } from "@/lib/client-ip";
import { proxy } from "@/proxy";

describe("safeRedirectPath", () => {
  it("keeps paths on this site", () => {
    expect(safeRedirectPath("/account/wholesale")).toBe("/account/wholesale");
    expect(safeRedirectPath("/account/orders?page=2#top")).toBe("/account/orders?page=2#top");
    expect(safeRedirectPath("/admin", "/admin")).toBe("/admin");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
    "evil.example",
    "",
  ])("refuses %j", (next) => {
    expect(safeRedirectPath(next)).toBe("/account");
  });

  it("leaves encoded characters encoded, so they stay part of a path here", () => {
    expect(safeRedirectPath("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });

  it("uses the fallback for missing or huge values", () => {
    expect(safeRedirectPath(undefined, "/admin")).toBe("/admin");
    expect(safeRedirectPath(`/${"a".repeat(3000)}`)).toBe("/account");
  });
});

describe("clientIpFrom", () => {
  it("prefers x-real-ip", () => {
    expect(clientIpFrom("203.0.113.9", "1.1.1.1, 203.0.113.9")).toBe("203.0.113.9");
  });

  it("ignores the visitor-chosen first x-forwarded-for entry", () => {
    expect(clientIpFrom(null, "6.6.6.6, 203.0.113.9")).toBe("203.0.113.9");
  });

  it("falls back when nothing usable is sent", () => {
    expect(clientIpFrom(null, null)).toBe("0.0.0.0");
    expect(clientIpFrom("", " , ")).toBe("0.0.0.0");
    expect(clientIpFrom("x".repeat(100), null)).toBe("0.0.0.0");
  });
});

describe("proxy", () => {
  it("sets a per-request script nonce and no inline-script loophole", () => {
    const first = proxy(new NextRequest("http://localhost:3000/"));
    const second = proxy(new NextRequest("http://localhost:3000/"));
    const csp = first.headers.get("content-security-policy")!;
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeTruthy();
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(second.headers.get("content-security-policy")).not.toContain(nonce);
  });

  it("overwrites an x-pathname sent by the visitor", () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/account/orders", { headers: { "x-pathname": "https://evil.example" } }),
    );
    expect(response.headers.get("x-middleware-request-x-pathname")).toBe("/account/orders");
  });

  it("seeds a CSRF cookie only when missing", () => {
    const fresh = proxy(new NextRequest("http://localhost:3000/"));
    expect(fresh.cookies.get("hf_csrf")?.value).toMatch(/^[0-9a-f]{64}$/);
    const returning = proxy(
      new NextRequest("http://localhost:3000/", { headers: { cookie: `hf_csrf=${"a".repeat(64)}` } }),
    );
    expect(returning.cookies.get("hf_csrf")).toBeUndefined();
  });
});
