import { z } from "zod";
import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { MAX_FILE_BYTES } from "@/lib/upload";
import { cuidSchema } from "@/lib/validators";
import { addDocument, removeDocument } from "@/server/wholesale/account";

export const runtime = "nodejs";

/** Upload one business document (GST certificate, shop photo, visiting card). Stored privately. */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "wholesale-document", ...RATE_LIMITS.wholesaleDocument } });
  if (!gate.ok) return gate.response;
  if (!(request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    return fail("Expected a multipart/form-data upload.", 415);
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_FILE_BYTES + 64 * 1024) {
    return fail(`Files must be under ${MAX_FILE_BYTES / 1024 / 1024} MB.`, 413);
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("Could not read the uploaded file.", 400);
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Choose a file to upload.", 422);
  const document = await addDocument(gate.ctx.user!, String(formData.get("kind") ?? ""), file);
  return ok({ document }, 201);
});

export const DELETE = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "wholesale-document", ...RATE_LIMITS.wholesaleDocument } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, z.object({ id: cuidSchema }));
  if (!parsed.ok) return parsed.response;
  await removeDocument(gate.ctx.user!, parsed.data.id);
  return ok({ success: true });
});
