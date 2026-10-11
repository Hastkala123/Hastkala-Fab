import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Secure image ingestion for the admin portal.
 *
 * Threat model: an attacker with (or who steals) admin access uploads a file
 * that the web server later executes or that the browser renders as HTML.
 * Defences, in order:
 *   1. Size cap enforced before the buffer is read into memory.
 *   2. Content sniffing by magic bytes — the client-supplied MIME type and
 *      filename extension are both ignored entirely.
 *   3. SVG is rejected outright: it is an XML document that can carry script.
 *   4. Filenames are regenerated as UUIDs, so path traversal ("../../app.js"),
 *      null bytes and double extensions ("x.png.php") are structurally
 *      impossible rather than filtered.
 *   5. Files land in public/uploads, which next.config.ts serves with
 *      `X-Content-Type-Options: nosniff` and a sandboxed CSP.
 */

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_FILES_PER_REQUEST = 12;

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

type Signature = { ext: string; mime: string; test: (b: Buffer) => boolean };

/**
 * Magic-byte signatures for the formats we accept. Anything that does not match
 * one of these is rejected, so a renamed script or polyglot never lands.
 */
const SIGNATURES: Signature[] = [
  {
    ext: "jpg",
    mime: "image/jpeg",
    test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: "png",
    mime: "image/png",
    test: (b) =>
      b.length > 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    ext: "webp",
    mime: "image/webp",
    test: (b) =>
      b.length > 12 &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP",
  },
  {
    ext: "gif",
    mime: "image/gif",
    test: (b) => b.length > 6 && ["GIF87a", "GIF88a", "GIF89a"].includes(b.toString("ascii", 0, 6)),
  },
  {
    ext: "avif",
    mime: "image/avif",
    test: (b) =>
      b.length > 12 &&
      b.toString("ascii", 4, 8) === "ftyp" &&
      ["avif", "avis"].includes(b.toString("ascii", 8, 12)),
  },
];

export type UploadResult =
  | { ok: true; url: string; bytes: number; mime: string }
  | { ok: false; error: string };

function detect(buffer: Buffer): Signature | null {
  return SIGNATURES.find((sig) => sig.test(buffer)) ?? null;
}

/**
 * Some encoders happily produce a valid PNG header followed by an HTML payload.
 * Scanning the first 2 KB for markup catches those polyglots cheaply.
 */
function looksLikeMarkup(buffer: Buffer): boolean {
  const head = buffer.toString("latin1", 0, Math.min(buffer.length, 2048)).toLowerCase();
  return (
    head.includes("<?php") ||
    head.includes("<script") ||
    head.includes("<!doctype html") ||
    head.includes("<html") ||
    head.includes("<svg")
  );
}

export async function saveUploadedImage(file: File): Promise<UploadResult> {
  if (!(file instanceof File)) return { ok: false, error: "No file provided" };
  if (file.size === 0) return { ok: false, error: "File is empty" };
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `"${sanitiseForMessage(file.name)}" is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Re-check after reading: `file.size` is client-reported metadata.
  if (buffer.length > MAX_FILE_BYTES) {
    return { ok: false, error: "File exceeds the maximum allowed size" };
  }

  const signature = detect(buffer);
  if (!signature) {
    return {
      ok: false,
      error: "Only JPG, PNG, WebP, GIF or AVIF images are allowed",
    };
  }

  if (looksLikeMarkup(buffer)) {
    return { ok: false, error: "File rejected: embedded markup detected" };
  }

  // UUID filename: no attacker-controlled bytes reach the filesystem path.
  const filename = `${randomUUID()}.${signature.ext}`;
  const destination = path.join(UPLOAD_DIR, filename);

  // Belt-and-braces: assert the resolved path is still inside UPLOAD_DIR.
  if (!destination.startsWith(UPLOAD_DIR + path.sep)) {
    return { ok: false, error: "Invalid upload path" };
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(destination, buffer, { mode: 0o644 });

  return {
    ok: true,
    url: `/uploads/${filename}`,
    bytes: buffer.length,
    mime: signature.mime,
  };
}

/** Strips anything that could corrupt an error message rendered back to the UI. */
function sanitiseForMessage(name: string): string {
  return name.replace(/[^\w.\- ]/g, "").slice(0, 60) || "file";
}

/**
 * Validates that a stored image URL is one of ours before persisting it to the
 * database. Blocks an admin (or a tampered request) from pointing a product
 * image at an external tracker or a `javascript:` URL.
 */
export function isSafeImageUrl(url: string): boolean {
  if (!url) return false;
  if (!url.startsWith("/uploads/")) return false;
  if (url.includes("..") || url.includes("\0")) return false;
  return /^\/uploads\/[A-Za-z0-9-]+\.(jpg|png|webp|gif|avif)$/.test(url);
}
