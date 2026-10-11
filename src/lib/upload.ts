import "server-only";

import { isValidStorageKey, savePublicFile } from "@/server/storage";

/**
 * Secure image ingestion for the admin portal and review photos.
 *
 * Threat model: someone with (or who steals) staff access uploads a file that
 * the browser later renders as HTML or script. Defences, in order:
 *   1. Size cap, re-checked after reading (file.size is client metadata).
 *   2. Content sniffing by magic bytes — the client MIME type and filename
 *      are ignored entirely.
 *   3. SVG is rejected outright: it is an XML document that can carry script.
 *   4. Names are random UUIDs chosen by the server (src/server/storage).
 *   5. Files are served by /media with nosniff and a sandboxed CSP.
 */

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_FILES_PER_REQUEST = 12;

type Signature = { ext: string; mime: string; test: (b: Buffer) => boolean };

const SIGNATURES: Signature[] = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: "png",
    mime: "image/png",
    test: (b) =>
      b.length > 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    ext: "webp",
    mime: "image/webp",
    test: (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
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
      b.length > 12 && b.toString("ascii", 4, 8) === "ftyp" && ["avif", "avis"].includes(b.toString("ascii", 8, 12)),
  },
];

export type UploadResult =
  | { ok: true; url: string; storageKey: string; bytes: number; mime: string }
  | { ok: false; error: string };

/**
 * Some encoders happily produce a valid PNG header followed by an HTML payload.
 * Scanning the first 2 KB for markup catches those polyglots cheaply.
 */
function looksLikeMarkup(buffer: Buffer): boolean {
  const head = buffer.toString("latin1", 0, Math.min(buffer.length, 2048)).toLowerCase();
  return ["<?php", "<script", "<!doctype html", "<html", "<svg"].some((m) => head.includes(m));
}

export type UploadFolder = "products" | "categories" | "banners" | "reviews" | "content";

export async function saveUploadedImage(file: File, folder: UploadFolder): Promise<UploadResult> {
  if (!(file instanceof File)) return { ok: false, error: "No file provided" };
  if (file.size === 0) return { ok: false, error: "File is empty" };
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `"${sanitiseForMessage(file.name)}" is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_FILE_BYTES) return { ok: false, error: "File exceeds the maximum allowed size" };

  const signature = SIGNATURES.find((sig) => sig.test(buffer));
  if (!signature) return { ok: false, error: "Only JPG, PNG, WebP, GIF or AVIF images are allowed" };
  if (looksLikeMarkup(buffer)) return { ok: false, error: "File rejected: embedded markup detected" };

  const saved = await savePublicFile(folder, signature.ext, buffer);
  return { ok: true, ...saved, bytes: buffer.length, mime: signature.mime };
}

function sanitiseForMessage(name: string): string {
  return name.replace(/[^\w.\- ]/g, "").slice(0, 60) || "file";
}

/**
 * Only images we stored ourselves may be saved on products and categories —
 * never an external tracker or a `javascript:` URL. Returns the storage key.
 */
export function mediaKeyFromUrl(url: string): string | null {
  if (!url.startsWith("/media/")) return null;
  const key = url.slice("/media/".length);
  return isValidStorageKey(key) && !key.endsWith(".pdf") ? key : null;
}

export function isSafeImageUrl(url: string): boolean {
  return mediaKeyFromUrl(url) !== null;
}
