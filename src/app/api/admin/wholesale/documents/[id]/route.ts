import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, guard, handler } from "@/lib/api";
import { audit } from "@/lib/audit";
import { cuidSchema } from "@/lib/validators";
import { readPrivateFile } from "@/server/storage";

export const runtime = "nodejs";

/**
 * A buyer's private document, for staff reviewing the application. Served
 * with no caching and as a download for anything but images and PDFs.
 */
export const GET = handler(async (_request, context) => {
  const gate = await guard({ auth: "staff", permission: "wholesale.manage", csrf: false });
  if (!gate.ok) return gate.response;
  const params = z.object({ id: cuidSchema }).safeParse(await context.params);
  if (!params.success) return fail("Not found", 404);

  const document = await db.wholesaleDocument.findUnique({ where: { id: params.data.id } });
  if (!document) return fail("Not found", 404);
  const bytes = await readPrivateFile(document.storageKey);
  if (!bytes) return fail("The file is missing from storage.", 404);

  await audit({ actor: gate.ctx.user, action: "wholesale.document.view", entityType: "WholesaleDocument", entityId: document.id });
  const inline = ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(document.mimeType);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${document.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
});
