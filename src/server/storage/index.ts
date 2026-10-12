import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * File storage behind one interface. Development (and any single-server
 * deployment with a persistent disk) uses the local ./storage folder; a
 * Cloudinary or S3 driver plugs in here for serverless hosting.
 *
 * Files are served by the /media/[...key] route — never from public/, which
 * Next.js only serves for files that existed at build time (fixes C5).
 */

export type StoredFile = { storageKey: string; url: string };

/** Public product/category/review media. */
const PUBLIC_ROOT = path.join(process.cwd(), "storage", "media");
/** Private documents (GST certificates, refund proofs): never publicly routable. */
const PRIVATE_ROOT = path.join(process.cwd(), "storage", "private");

const KEY_PATTERN = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*\.(?:jpg|png|webp|gif|avif|pdf)$/;

export function isValidStorageKey(key: string): boolean {
  return KEY_PATTERN.test(key) && !key.includes("..");
}

function resolveKey(root: string, key: string): string {
  if (!isValidStorageKey(key)) throw new Error("Invalid storage key");
  const full = path.join(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export function publicUrl(storageKey: string): string {
  return `/media/${storageKey}`;
}

/** Saves bytes under folder/<uuid>.<ext>; the name is never attacker-controlled. */
export async function savePublicFile(folder: string, ext: string, bytes: Buffer): Promise<StoredFile> {
  const storageKey = `${folder}/${randomUUID()}.${ext}`;
  const full = resolveKey(PUBLIC_ROOT, storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes, { mode: 0o644 });
  return { storageKey, url: publicUrl(storageKey) };
}

export async function savePrivateFile(folder: string, ext: string, bytes: Buffer): Promise<{ storageKey: string }> {
  const storageKey = `${folder}/${randomUUID()}.${ext}`;
  const full = resolveKey(PRIVATE_ROOT, storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes, { mode: 0o600 });
  return { storageKey };
}

export async function readPublicFile(storageKey: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveKey(PUBLIC_ROOT, storageKey));
  } catch {
    return null;
  }
}

export async function readPrivateFile(storageKey: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveKey(PRIVATE_ROOT, storageKey));
  } catch {
    return null;
  }
}

export async function deletePrivateFile(storageKey: string): Promise<void> {
  await unlink(resolveKey(PRIVATE_ROOT, storageKey)).catch(() => undefined);
}

export async function deletePublicFile(storageKey: string): Promise<void> {
  await unlink(resolveKey(PUBLIC_ROOT, storageKey)).catch(() => undefined);
}

export const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  pdf: "application/pdf",
};
