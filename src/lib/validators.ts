import { z } from "zod";
import { checkGstin, STATE_NAME_TO_CODE } from "./gstin";
import { normalizeIndianMobile } from "./phone";

/**
 * Single source of truth for every user-supplied shape in the app.
 * Route handlers must parse through these — no hand-rolled `body.foo` reads.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const cuidSchema = z.string().min(1).max(64).regex(/^[a-z0-9]+$/i, "Invalid id");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, "Email is too short")
  .max(254, "Email is too long")
  .email("Enter a valid email address");

/** Indian mobile in any common spelling, stored as +91XXXXXXXXXX. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const phone = normalizeIndianMobile(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit Indian mobile number" });
      return z.NEVER;
    }
    return phone;
  });

export const optionalPhoneSchema = z
  .string()
  .trim()
  .max(20)
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const phone = normalizeIndianMobile(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit Indian mobile number" });
      return z.NEVER;
    }
    return phone;
  });

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code");

/**
 * Length is the dominant factor in resistance to offline cracking, so we ask
 * for 10+ characters rather than piling on symbol rules.
 */
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password must be under 128 characters")
  .refine((v) => /[a-z]/.test(v), "Include at least one lowercase letter")
  .refine((v) => /[A-Z]/.test(v), "Include at least one uppercase letter")
  .refine((v) => /\d/.test(v), "Include at least one number");

/** Matches C0/C1 control characters, excluding tab, LF and CR. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

/** Rejects control characters that break rendering or smuggle terminal escapes. */
export const safeText = (min: number, max: number, label = "This field") =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be under ${max} characters`)
    .refine((v) => !CONTROL_CHARS.test(v), { message: `${label} contains invalid characters` });

/** Optional text: "" and missing both become null. */
export const optionalText = (max: number, label = "This field") =>
  z
    .string()
    .trim()
    .max(max, `${label} must be under ${max} characters`)
    .refine((v) => !CONTROL_CHARS.test(v), { message: `${label} contains invalid characters` })
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only");

/** Rupees typed in a form (e.g. 1299.50), stored as paise. */
export const rupeesSchema = z.coerce
  .number({ message: "Enter an amount" })
  .min(0, "Amount cannot be negative")
  .max(10_000_000, "Amount is unrealistically high")
  .transform((v) => Math.round(v * 100));

export const optionalRupeesSchema = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.number().min(0).max(10_000_000)])
  .transform((v) => (v === "" || v == null ? null : Math.round(v * 100)));

export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((value, ctx) => {
    const result = checkGstin(value);
    if (!result.valid) {
      ctx.addIssue({ code: "custom", message: result.reason });
      return z.NEVER;
    }
    return result.gstin;
  });

export const optionalGstinSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value, ctx) => {
    if (!value) return null;
    const result = checkGstin(value);
    if (!result.valid) {
      ctx.addIssue({ code: "custom", message: result.reason });
      return z.NEVER;
    }
    return result.gstin;
  });

const dateInput = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.date()])
  .transform((v) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v : null));

// ---------------------------------------------------------------------------
// Auth & account
// ---------------------------------------------------------------------------

export const signupSchema = z
  .object({
    name: safeText(2, 80, "Name"),
    email: emailSchema,
    phone: optionalPhoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    accountType: z.enum(["RETAIL", "WHOLESALE"]).default("RETAIL"),
    businessName: optionalText(120, "Business name"),
    gstin: optionalGstinSchema,
    city: optionalText(60, "City"),
    acceptTerms: z.literal(true, { message: "You must accept the Terms and Privacy Policy" }),
    marketingOptIn: z.boolean().default(false),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => d.accountType !== "WHOLESALE" || !!d.businessName, {
    message: "Business name is required for a wholesale account",
    path: ["businessName"],
  })
  .refine((d) => d.accountType !== "WHOLESALE" || !!d.phone, {
    message: "We need a mobile number to confirm wholesale orders",
    path: ["phone"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(128),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
    signOutOthers: z.boolean().default(true),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  });

export const updateProfileSchema = z.object({
  name: safeText(2, 80, "Name"),
  phone: optionalPhoneSchema,
});

export const addressSchema = z.object({
  label: z.enum(["HOME", "WORK", "SHOP", "OTHER"]).default("HOME"),
  fullName: safeText(2, 80, "Full name"),
  phone: phoneSchema,
  line1: safeText(5, 150, "House / street"),
  line2: optionalText(150, "Area"),
  landmark: optionalText(100, "Landmark"),
  city: safeText(2, 60, "City"),
  state: z.string().refine((s) => s in STATE_NAME_TO_CODE, "Choose your state"),
  pincode: pincodeSchema,
  gstin: optionalGstinSchema,
  isDefault: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Catalogue (admin)
// ---------------------------------------------------------------------------

const imageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .regex(/^\/media\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\.(?:jpg|png|webp|gif|avif)$/, "Upload the image here first");

const optionalImageUrl = z
  .union([z.literal(""), z.null(), z.undefined(), imageUrlSchema])
  .transform((v) => (v ? v : null));

export const categorySchema = z.object({
  name: safeText(2, 80, "Category name"),
  slug: slugSchema,
  description: optionalText(2000, "Description"),
  bottomContent: optionalText(10_000, "Bottom-of-page text"),
  imageUrl: optionalImageUrl,
  bannerImageUrl: optionalImageUrl,
  parentId: z.union([z.literal(""), z.null(), z.undefined(), cuidSchema]).transform((v) => v || null),
  hsnCodeId: z.union([z.literal(""), z.null(), z.undefined(), cuidSchema]).transform((v) => v || null),
  isActive: z.boolean().default(true),
  showInMenu: z.boolean().default(true),
  metaTitle: optionalText(70, "Meta title"),
  metaDescription: optionalText(170, "Meta description"),
});

export const reorderSchema = z.object({
  ids: z.array(cuidSchema).min(1).max(1000),
});

export const variantInputSchema = z
  .object({
    id: cuidSchema.optional(),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, "SKU is required")
      .max(60)
      .regex(/^[A-Z0-9][A-Z0-9_-]*$/, "SKU: letters, numbers, - and _ only"),
    size: optionalText(30, "Size"),
    colorName: optionalText(40, "Colour"),
    colorHex: z
      .union([z.literal(""), z.null(), z.undefined(), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #1f3a5f")])
      .transform((v) => v || null),
    packQuantity: z.coerce.number().int().min(1).max(100).default(1),
    label: optionalText(60, "Variant label"),
    price: optionalRupeesSchema,
    mrp: optionalRupeesSchema,
    stock: z.coerce.number().int().min(0, "Stock cannot be negative").max(1_000_000),
    lowStockThreshold: z.coerce.number().int().min(0).max(10_000).default(3),
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.price == null || v.mrp == null || v.mrp >= v.price, {
    message: "MRP must be at least the selling price",
    path: ["mrp"],
  });

export const productSchema = z
  .object({
    title: safeText(3, 160, "Product name"),
    slug: slugSchema,
    shortDescription: optionalText(300, "Short description"),
    description: safeText(20, 10_000, "Description"),
    categoryId: cuidSchema,
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
    publishAt: dateInput,
    printTechnique: z.enum(["HAND_BLOCK", "SCREEN", "DIGITAL", "HAND_PAINTED", "OTHER"]),
    hsnCodeId: z.union([z.literal(""), z.null(), z.undefined(), cuidSchema]).transform((v) => v || null),
    price: rupeesSchema.refine((v) => v > 0, "Enter the selling price"),
    mrp: rupeesSchema.refine((v) => v > 0, "Enter the MRP"),
    wholesaleEnabled: z.boolean().default(false),
    wholesaleMinQty: z.coerce.number().int().min(1).max(100_000).default(1),
    wholesalePrices: z
      .array(
        z.object({
          minQuantity: z.coerce.number().int().min(1).max(100_000),
          unitPrice: rupeesSchema.refine((v) => v > 0, "Enter the wholesale price"),
        }),
      )
      .max(10)
      .default([]),
    weightGrams: z.union([z.literal(""), z.null(), z.undefined(), z.coerce.number().int().min(1).max(100_000)]).transform((v) => (v === "" || v == null ? null : v)),
    careInstructions: optionalText(1000, "Care instructions"),
    isReturnable: z.boolean().default(true),
    isCodAllowed: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    isNewArrival: z.boolean().default(false),
    metaTitle: optionalText(70, "Meta title"),
    metaDescription: optionalText(170, "Meta description"),
    searchKeywords: z
      .string()
      .max(2000)
      .default("")
      .transform((v) => [
        ...new Set(
          v
            .split(/[,\n]/)
            .map((k) => k.trim().toLowerCase())
            .filter((k) => k.length > 1 && k.length <= 80),
        ),
      ].slice(0, 60)),
    media: z
      .array(z.object({ url: imageUrlSchema, alt: optionalText(160, "Image description") }))
      .max(15, "A product can have at most 15 images")
      .default([]),
    variants: z.array(variantInputSchema).min(1, "Add at least one size or colour").max(100),
    /** Attribute id → value(s). */
    attributes: z.record(cuidSchema, z.union([z.string().trim().max(200), z.array(z.string().trim().max(200)).max(30)])).default({}),
  })
  .refine((d) => d.mrp >= d.price, { message: "MRP must be at least the selling price", path: ["mrp"] })
  .refine((d) => !d.wholesaleEnabled || d.wholesalePrices.length > 0, {
    message: "Add at least one wholesale price, or turn wholesale off",
    path: ["wholesalePrices"],
  })
  .refine((d) => new Set(d.variants.map((v) => v.sku)).size === d.variants.length, {
    message: "Each size/colour needs its own SKU",
    path: ["variants"],
  })
  .refine((d) => new Set(d.wholesalePrices.map((w) => w.minQuantity)).size === d.wholesalePrices.length, {
    message: "Two wholesale prices have the same minimum quantity",
    path: ["wholesalePrices"],
  });

// ---------------------------------------------------------------------------
// Cart & checkout
// ---------------------------------------------------------------------------

export const addToCartSchema = z.object({
  variantId: cuidSchema,
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(100_000),
});

export const updateCartSchema = z.object({
  itemId: cuidSchema,
  quantity: z.coerce.number().int().min(0).max(100_000),
});

export const applyCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .max(30)
    .regex(/^[A-Z0-9_-]*$/, "Coupon codes use letters and numbers only")
    .nullable(),
});

export const giftWrapSchema = z.object({
  giftWrap: z.boolean(),
  giftMessage: optionalText(200, "Gift message"),
});

export const checkoutSchema = z.object({
  addressId: cuidSchema,
  paymentMethod: z.enum(["COD", "UPI", "CARD", "NETBANKING"]),
  customerNote: optionalText(500, "Note"),
  idempotencyKey: z.string().uuid("Please refresh the page and try again"),
});

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3)
      .max(30)
      .regex(/^[A-Z0-9_-]+$/, "Use letters, numbers, hyphen and underscore only"),
    description: optionalText(200, "Description"),
    type: z.enum(["PERCENT", "FLAT", "FREE_SHIPPING"]),
    /** Whole percent for PERCENT; rupees for FLAT (converted below). */
    value: z.coerce.number().min(0).max(10_000_000),
    minOrderValue: rupeesSchema.default(0),
    maxDiscount: optionalRupeesSchema,
    audience: z.enum(["ALL", "RETAIL", "WHOLESALE"]).default("ALL"),
    firstOrderOnly: z.boolean().default(false),
    usageLimit: z.union([z.literal(""), z.null(), z.undefined(), z.coerce.number().int().min(1).max(10_000_000)]).transform((v) => (v === "" || v == null ? null : v)),
    perUserLimit: z.coerce.number().int().min(1).max(1000).default(1),
    startsAt: dateInput,
    endsAt: dateInput,
    isActive: z.boolean().default(true),
    categoryIds: z.array(cuidSchema).max(100).default([]),
  })
  .refine((d) => d.type !== "PERCENT" || (d.value >= 1 && d.value <= 90 && Number.isInteger(d.value)), {
    message: "A percentage discount is a whole number from 1 to 90",
    path: ["value"],
  })
  .refine((d) => d.type !== "FLAT" || d.value > 0, { message: "Enter the discount in rupees", path: ["value"] })
  .refine((d) => !d.startsAt || !d.endsAt || d.endsAt > d.startsAt, {
    message: "The end date must be after the start date",
    path: ["endsAt"],
  })
  .transform((d) => ({ ...d, value: d.type === "FLAT" ? Math.round(d.value * 100) : d.type === "PERCENT" ? d.value : 0 }));

// ---------------------------------------------------------------------------
// Reviews, support, newsletter
// ---------------------------------------------------------------------------

export const reviewSchema = z.object({
  productId: cuidSchema,
  rating: z.coerce.number().int().min(1, "Pick a rating").max(5),
  title: optionalText(100, "Title"),
  body: safeText(10, 2000, "Review"),
});

export const ticketSchema = z.object({
  subject: safeText(5, 150, "Subject"),
  category: z.enum(["ORDER", "PAYMENT", "DELIVERY", "RETURN", "PRODUCT", "WHOLESALE", "ACCOUNT", "OTHER"]),
  orderNumber: optionalText(20, "Order number"),
  message: safeText(10, 4000, "Message"),
});

export const ticketReplySchema = z.object({
  ticketId: cuidSchema,
  body: safeText(1, 4000, "Message"),
  isInternal: z.boolean().default(false),
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"]).optional(),
});

export const newsletterSchema = z.object({ email: emailSchema });

// ---------------------------------------------------------------------------
// Admin operations
// ---------------------------------------------------------------------------

export const ORDER_STATUS_VALUES = [
  "PENDING_PAYMENT",
  "PAYMENT_FAILED",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RTO_IN_TRANSIT",
  "RTO_DELIVERED",
] as const;

export const orderStatusSchema = z.object({
  orderId: cuidSchema,
  status: z.enum(ORDER_STATUS_VALUES),
  expectedFrom: z.enum(ORDER_STATUS_VALUES),
  note: optionalText(500, "Note"),
  customerVisible: z.boolean().default(true),
});

export const orderNoteSchema = z.object({
  orderId: cuidSchema,
  note: safeText(1, 1000, "Note"),
});

export const customerAdminSchema = z.object({
  userId: cuidSchema,
  status: z.enum(["ACTIVE", "BLOCKED"]).optional(),
  wholesaleStatus: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]).optional(),
  rejectionReason: optionalText(300, "Reason"),
  priceTierId: z.union([z.literal(""), z.null(), z.undefined(), cuidSchema]).transform((v) => v || null),
});

export const reviewModerationSchema = z.object({
  reviewId: cuidSchema,
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: optionalText(300, "Reason"),
});

// ---------------------------------------------------------------------------
// Storefront query params
// ---------------------------------------------------------------------------

const listParam = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) =>
    (Array.isArray(v) ? v : v ? v.split(",") : [])
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 60)
      .slice(0, 20),
  );

export const listingQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  min: z.coerce.number().int().min(0).max(10_000_000).optional().catch(undefined),
  max: z.coerce.number().int().min(0).max(10_000_000).optional().catch(undefined),
  size: listParam.catch([]),
  color: listParam.catch([]),
  stock: z.literal("1").optional().catch(undefined),
  sort: z.enum(["recommended", "newest", "price-asc", "price-desc", "popular"]).default("recommended").catch("recommended"),
  page: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProductInput = z.output<typeof productSchema>;
export type AddressInput = z.output<typeof addressSchema>;
export type CategoryInput = z.output<typeof categorySchema>;
export type CouponInput = z.output<typeof couponSchema>;
