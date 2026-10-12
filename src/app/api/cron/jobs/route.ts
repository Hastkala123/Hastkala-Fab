import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { env } from "@/lib/env";
import { runScheduledTasks } from "@/server/jobs/tasks";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorised(request: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Every-minute background work (unpaid-order expiry, payment checks, queued
 * jobs). Called by Vercel Cron (GET) or any scheduler (POST) with
 * "Authorization: Bearer $CRON_SECRET".
 */
const run = handler(async (request) => {
  if (!env.CRON_SECRET) return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, report: await runScheduledTasks() });
});

export const GET = run;
export const POST = run;
