/**
 * Every store setting the owner can change in Admin → Settings, with its
 * shape and its default. Defaults are placeholders until the owner saves the
 * section — the admin dashboard lists unsaved sections as "to confirm".
 *
 * Money is paise. Adding a field: give it a default so old rows still parse.
 */
import { z } from "zod";

const paise = z.number().int().min(0).max(100_000_000);

export const SETTING_SCHEMAS = {
  "store.profile": z.object({
    displayName: z.string().trim().min(2).max(80).default("Hastkala Fab"),
    legalName: z.string().trim().max(160).default(""),
    gstin: z.string().trim().max(15).default(""),
    /** GST state code of the place of business ("08" = Rajasthan). */
    stateCode: z.string().regex(/^\d{2}$/, "Choose a state").default("08"),
    addressLine1: z.string().trim().max(160).default(""),
    addressLine2: z.string().trim().max(160).default(""),
    city: z.string().trim().max(60).default("Jaipur"),
    state: z.string().trim().max(60).default("Rajasthan"),
    pincode: z.string().trim().max(6).default(""),
    phone: z.string().trim().max(20).default(""),
    whatsapp: z.string().trim().max(20).default(""),
    email: z.string().trim().max(254).default(""),
    grievanceOfficerName: z.string().trim().max(80).default(""),
    grievanceOfficerEmail: z.string().trim().max(254).default(""),
    grievanceOfficerPhone: z.string().trim().max(20).default(""),
    /** Invoice numbers look like {prefix}/26-27/000123 (max 16 characters). */
    invoicePrefix: z
      .string()
      .trim()
      .regex(/^[A-Z0-9]{1,4}$/, "Use 1 to 4 capital letters or numbers, like HF")
      .default("HF"),
  }),

  shipping: z.object({
    /** Retail orders at or above this (incl. GST) ship free; null = never. */
    freeShippingThreshold: paise.nullable().default(99_900),
    retailFee: paise.default(7_900),
    /** Freight charged on wholesale orders (0 = arranged separately). */
    wholesaleFee: paise.default(0),
    dispatchText: z.string().trim().max(120).default("Dispatched from Jaipur in 1–2 working days"),
    deliveryText: z.string().trim().max(160).default("3–5 working days to metros, 5–8 elsewhere"),
  }),

  cod: z.object({
    enabled: z.boolean().default(true),
    fee: paise.default(0),
    maxOrderValue: paise.nullable().default(1_000_000),
    /** COD orders above this need a one-time code before they are placed. */
    otpAboveValue: paise.nullable().default(300_000),
  }),

  returns: z.object({
    windowDays: z.number().int().min(0).max(90).default(7),
    allowExchange: z.boolean().default(true),
    conditionsText: z
      .string()
      .trim()
      .max(500)
      .default("Unused, unwashed, with tags intact. Unstitched fabric that has been cut cannot be returned."),
    /** Deducted from refunds of returns that are not our fault (0 = none). */
    returnShippingDeduction: paise.default(0),
  }),

  tax: z.object({
    /** Owner's decision (11 Oct 2026): wholesale prices are "+ GST". */
    wholesalePricesIncludeTax: z.boolean().default(false),
    feeTaxMode: z.enum(["PROPORTIONAL", "HIGHEST_RATE"]).default("PROPORTIONAL"),
    roundTotalToRupee: z.boolean().default(false),
    /** Owner's decision: invoice when the order is confirmed. */
    invoiceTrigger: z.enum(["CONFIRMED", "SHIPPED"]).default("CONFIRMED"),
    /** Set when the owner's CA has confirmed the HSN codes and rates. */
    ratesConfirmedByCa: z.boolean().default(false),
  }),

  checkout: z.object({
    /** Switch off to stop taking UPI / card / net banking (for example during a gateway outage). */
    onlinePaymentsEnabled: z.boolean().default(true),
    /** Owner's decision: unpaid online orders release stock after 30 min. */
    paymentWindowMinutes: z.number().int().min(5).max(24 * 60).default(30),
    giftWrapEnabled: z.boolean().default(false),
    giftWrapFee: paise.default(0),
    maxQuantityPerLine: z.number().int().min(1).max(10_000).default(20),
  }),

  wholesale: z.object({
    minOrderValue: paise.default(0),
    maxQuantityPerLine: z.number().int().min(1).max(100_000).default(1_000),
    requireGstin: z.boolean().default(true),
    /** Advance taken at checkout on "advance + balance" terms, unless the buyer has their own %. */
    advancePercent: z.number().int().min(1).max(99).default(30),
    /** Days to pay on credit terms, unless the buyer has their own. */
    creditDays: z.number().int().min(1).max(180).default(30),
    allowCod: z.boolean().default(false),
    bankTransferEnabled: z.boolean().default(true),
    /** How long stock is held for an order waiting for a bank transfer. */
    bankTransferHoldHours: z.number().int().min(1).max(14 * 24).default(48),
    bankAccountName: z.string().trim().max(120).default(""),
    bankAccountNumber: z.string().trim().max(34).default(""),
    bankIfsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^$|^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter an 11-character IFSC like HDFC0001234")
      .default(""),
    bankName: z.string().trim().max(120).default(""),
    upiId: z.string().trim().max(80).default(""),
    landingHeadline: z.string().trim().max(120).default("Sanganeri hand-block prints, wholesale from Jaipur"),
    landingIntro: z
      .string()
      .trim()
      .max(1500)
      .default(
        "Kurtis, salwar suits, sarees and Jaipuri cotton bedsheets, printed by hand in Sanganer. Boutiques, resellers and retail stores across India buy direct from us at trade prices, with GST invoices and dispatch from Jaipur.",
      ),
    moqText: z.string().trim().max(300).default("Minimum quantities are shown on each design — sizes and colours combine towards them."),
    /** One question per line: "Question? | Answer". */
    faq: z
      .string()
      .trim()
      .max(6000)
      .default(
        [
          "Who can buy wholesale? | Boutiques, retail shops, resellers and online sellers. Apply with your business details; most accounts are approved within one working day.",
          "Do I need a GSTIN? | A GSTIN lets you claim input tax credit on our GST invoice. Without one, tell us about your business and we'll review it.",
          "Is there a minimum order? | Each design shows its minimum quantity. Sizes and colours of the same design count together.",
          "How do I pay? | Online (UPI, cards, net banking) or bank transfer. Regular buyers can be offered advance-and-balance or credit terms.",
          "How fast do you dispatch? | Ready stock leaves Jaipur in 1–3 working days. Custom colours and bulk prints take longer — ask us first.",
        ].join("\n"),
      ),
  }),

  seo: z.object({
    defaultTitle: z
      .string()
      .trim()
      .max(70)
      .default("Hastkala Fab — Sanganeri Hand Block Print Kurtis, Sarees, Suits & Bedsheets"),
    defaultDescription: z
      .string()
      .trim()
      .max(170)
      .default(
        "Shop Sanganeri hand-block print kurtis, salwar suits, sarees and Jaipuri cotton bedsheets from Sanganer, Jaipur. Retail and wholesale.",
      ),
    instagramUrl: z.string().trim().max(200).default(""),
    facebookUrl: z.string().trim().max(200).default(""),
    youtubeUrl: z.string().trim().max(200).default(""),
  }),
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SettingValue<K extends SettingKey> = z.output<(typeof SETTING_SCHEMAS)[K]>;
export type AllSettings = { [K in SettingKey]: SettingValue<K> };

export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[];

export const SETTING_LABELS: Record<SettingKey, string> = {
  "store.profile": "Business details",
  shipping: "Shipping",
  cod: "Cash on delivery",
  returns: "Returns",
  tax: "GST and invoices",
  checkout: "Checkout",
  wholesale: "Wholesale",
  seo: "Search and social",
};

export function defaultSetting<K extends SettingKey>(key: K): SettingValue<K> {
  return SETTING_SCHEMAS[key].parse({}) as SettingValue<K>;
}

/**
 * Reads a stored value leniently: unknown keys are dropped, missing or invalid
 * fields fall back to their defaults, so a schema change never breaks the shop.
 */
export function parseStoredSetting<K extends SettingKey>(key: K, stored: unknown): SettingValue<K> {
  const schema = SETTING_SCHEMAS[key];
  const base = typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>) : {};
  const result = schema.safeParse(base);
  if (result.success) return result.data as SettingValue<K>;

  // Keep every field that is individually valid; default the rest.
  const shape = (schema as unknown as z.ZodObject<z.ZodRawShape>).shape;
  const repaired: Record<string, unknown> = {};
  for (const [field, fieldSchema] of Object.entries(shape)) {
    const parsed = (fieldSchema as z.ZodType).safeParse(base[field]);
    if (parsed.success) repaired[field] = parsed.data;
  }
  return schema.parse(repaired) as SettingValue<K>;
}
