/**
 * The store runs on India time. Everything is stored in UTC and converted at
 * the edges here (fixes M3: dates and coupon expiries off by 5½ hours).
 */

export const STORE_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MINUTES = 330;

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: STORE_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: STORE_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: STORE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "11 Oct 2026" in IST. */
export function formatDateIST(date: Date | string): string {
  return dateFmt.format(new Date(date));
}

/** "11 Oct 2026, 1:15 pm" in IST. */
export function formatDateTimeIST(date: Date | string): string {
  return dateTimeFmt.format(new Date(date));
}

/** The IST calendar date as "YYYY-MM-DD". */
export function istDateString(date: Date): string {
  return partsFmt.format(date);
}

function parseYmd(ymd: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) throw new RangeError(`Expected YYYY-MM-DD, got "${ymd}"`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** 00:00:00.000 IST on that calendar day, as a UTC Date. */
export function istStartOfDay(ymd: string): Date {
  const [y, m, d] = parseYmd(ymd);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - IST_OFFSET_MINUTES * 60_000);
}

/** 23:59:59.999 IST on that calendar day — "valid until 31 Oct" means this. */
export function istEndOfDay(ymd: string): Date {
  return new Date(istStartOfDay(ymd).getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * Indian financial year (1 April – 31 March) for a moment, judged in IST.
 * 11 Oct 2026 → { label: "2026-27", short: "26-27" }.
 */
export function financialYear(date: Date): { label: string; short: string; startYear: number } {
  const [y, m] = parseYmd(istDateString(date));
  const startYear = m >= 4 ? y : y - 1;
  const end = (startYear + 1) % 100;
  return {
    startYear,
    label: `${startYear}-${String(end).padStart(2, "0")}`,
    short: `${String(startYear % 100).padStart(2, "0")}-${String(end).padStart(2, "0")}`,
  };
}
