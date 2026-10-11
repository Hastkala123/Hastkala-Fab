import { fail, guard, handler, ok } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { MAX_FILES_PER_REQUEST, saveUploadedImage } from "@/lib/upload";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST — multipart image upload for the admin product/category editors.
 *
 * Admin-only, CSRF-protected and rate limited. The heavy lifting (magic-byte
 * sniffing, size caps, UUID filenames) lives in lib/upload.ts.
 */
export const POST = handler(async (request) => {
  const gate = await guard({
    auth: "admin",
    csrf: true,
    limit: { bucket: "upload", ...RATE_LIMITS.upload },
  });
  if (!gate.ok) return gate.response;

  const admin = gate.ctx.user!;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return fail("Expected a multipart/form-data upload.", 415);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("Could not read the uploaded files.", 400);
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) return fail("No files were selected.", 422);
  if (files.length > MAX_FILES_PER_REQUEST) {
    return fail(`Upload at most ${MAX_FILES_PER_REQUEST} images at a time.`, 413);
  }

  const uploaded: { url: string; bytes: number }[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const result = await saveUploadedImage(file);
    if (result.ok) {
      uploaded.push({ url: result.url, bytes: result.bytes });
    } else {
      errors.push(result.error);
    }
  }

  if (uploaded.length === 0) {
    return fail(errors[0] ?? "No valid images were uploaded.", 422);
  }

  await audit({
    userId: admin.id,
    actorEmail: admin.email,
    action: "media.upload",
    entity: "ProductImage",
    metadata: { count: uploaded.length, rejected: errors.length },
  });

  return ok({ uploaded, errors }, 201);
});
