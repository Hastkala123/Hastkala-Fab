/**
 * Indian mobile numbers are stored in one canonical form, E.164 "+91XXXXXXXXXX",
 * so "+91 98765 43210", "098765-43210" and "9876543210" are the same person
 * (fixes M10: duplicate accounts on one phone).
 */

const MOBILE = /^(?:\+?91|0)?([6-9]\d{9})$/;

export function normalizeIndianMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  const compact = input.replace(/[\s\-().]/g, "");
  const match = MOBILE.exec(compact);
  return match ? `+91${match[1]}` : null;
}

/** "+919876543210" → "98765 43210" for display. */
export function formatIndianMobile(e164: string): string {
  const local = e164.replace(/^\+91/, "");
  return local.length === 10 ? `${local.slice(0, 5)} ${local.slice(5)}` : e164;
}

/** "+919876543210" → "98•••••210" for logs, notifications and support views. */
export function maskIndianMobile(e164: string): string {
  const local = e164.replace(/^\+91/, "");
  if (local.length !== 10) return "••••••••••";
  return `${local.slice(0, 2)}•••••${local.slice(7)}`;
}
