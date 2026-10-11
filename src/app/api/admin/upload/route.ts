import { z } from "zod";
import { fail, guard, handler, ok } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { MAX_FILES_PER_REQUEST, saveUploadedImage } from "@/lib/upload";

export const runtime = "nodejs";

const folderSchema = z.enum(["products", "categories", "banners", "content"]).catch("products");

/**
 * Multipart image upload for the admin editors. The checks (magic bytes,
 * size caps, random names) live in lib/upload.ts.
 */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "staff", permission: "catalog.manage", limit: { bucket: "upload", ...RATE_LIMITS.upload } });
  if (!gate.ok) return gate.response;

  if (!(request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    return fail("Expected a multipart/form-data upload.", 415);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("Could not read the uploaded files.", 400);
  }

  const folder = folderSchema.parse(formData.get("folder"));
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return fail("No files were selected.", 422);
  if (files.length > MAX_FILES_PER_REQUEST) return fail(`Upload at most ${MAX_FILES_PER_REQUEST} images at a time.`, 413);

  const uploaded: { url: string; bytes: number }[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const result = await saveUploadedImage(file, folder);
    if (result.ok) uploaded.push({ url: result.url, bytes: result.bytes });
    else errors.push(result.error);
  }
  if (uploaded.length === 0) return fail(errors[0] ?? "No valid images were uploaded.", 422);

  return ok({ uploaded, errors }, 201);
});
