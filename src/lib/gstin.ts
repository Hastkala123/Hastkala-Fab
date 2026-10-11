/**
 * GSTIN validation, including the 15th-character check digit (fixes M20).
 *
 * Structure: 2-digit state code · 10-character PAN · entity number ·
 * "Z" · check character (mod-36 checksum over the first 14 characters).
 */

const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const FORMAT = /^(\d{2})([A-Z]{5}\d{4}[A-Z])([1-9A-Z])Z([0-9A-Z])$/;

/** GST state codes. 97 = Other Territory, 99 = Centre Jurisdiction. */
export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

/** State name → GST state code, for addresses. */
export const STATE_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(GST_STATE_CODES)
    .filter(([code]) => code !== "97" && code !== "99")
    .map(([code, name]) => [name, code]),
);

export function gstinCheckCharacter(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = CHARSET.indexOf(first14[i]!);
    if (value < 0) throw new RangeError("Invalid GSTIN character");
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36]!;
}

export type GstinCheck =
  | { valid: true; gstin: string; stateCode: string; pan: string }
  | { valid: false; reason: string };

export function checkGstin(input: string): GstinCheck {
  const gstin = input.trim().toUpperCase();
  const match = FORMAT.exec(gstin);
  if (!match) return { valid: false, reason: "A GSTIN has 15 characters, like 08ABCDE1234F1Z5." };
  const stateCode = match[1]!;
  if (!GST_STATE_CODES[stateCode]) return { valid: false, reason: "The first two digits are not a valid state code." };
  if (gstinCheckCharacter(gstin.slice(0, 14)) !== gstin[14]) {
    return { valid: false, reason: "This GSTIN has a typo — the last character doesn't match. Please re-check it." };
  }
  return { valid: true, gstin, stateCode, pan: match[2]! };
}
