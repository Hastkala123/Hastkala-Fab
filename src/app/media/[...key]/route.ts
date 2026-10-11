import { NextResponse } from "next/server";
import { isValidStorageKey, MIME_BY_EXT, readPublicFile } from "@/server/storage";

export const runtime = "nodejs";

/**
 * Serves uploaded public media (product photos, category images). Keys are
 * validated against a strict pattern before touching the disk, and responses
 * are locked down so a file can never be interpreted as a page or script.
 */
export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params;
  const storageKey = key.join("/");

  if (!isValidStorageKey(storageKey) || storageKey.endsWith(".pdf")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const bytes = await readPublicFile(storageKey);
  if (!bytes) return new NextResponse("Not found", { status: 404 });

  const ext = storageKey.split(".").pop()!;
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
      // Names are random UUIDs and never reused, so caching forever is safe.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
