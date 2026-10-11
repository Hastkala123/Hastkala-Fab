import { z } from "zod";

/**
 * Single source of truth for every user-supplied shape in the app.
 * Route handlers and server actions must parse through these — no hand-rolled
 * `req.body.foo` reads anywhere.
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

/** Indian mobile: 10 digits starting 6-9, optional +91 prefix. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+91[-\s]?)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code");

/**
 * Password policy: length is the dominant factor in resistance to offline
 * cracking, so we require 10+ rather than piling on symbol classes that mostly
 * produce "Password1!".
 */
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password must be under 128 characters")
  .refine((v) => /[a-z]/.test(v), "Include at least one lowercase letter")
  .refine((v) => /[A-Z]/.test(v), "Include at least one uppercase letter")
  .refine((v) => /\d/.test(v), "Include at least one number");

/** Matches C0/C1 control characters, excluding tab (\\t), LF (\\n) and CR (\\r). */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

/** Rejects control characters that break rendering or smuggle terminal escapes. */
export const safeText = (min: number, max: number, label = "This field") =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be under ${max} characters`)
    // eslint-disable-next-line no-control-regex
    .refine((v) => !CONTROL_CHARS.test(v), {
      message: `${label} contains invalid characters`,
    });

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only");

/** Rupee amount from a form, stored as paise. */
export const priceSchema = z.coerce
  .number()
  .min(0, "Price cannot be negative")
  .max(10_000_000, "Price is unrealistically high")
  .transform((v) => Math.round(v * 100));

export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/,
    "Enter a valid 15-character GSTIN",
  );

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const signupSchema = z
  .object({
    name: safeText(2, 80, "Name"),
    email: emailSchema,
    phone: phoneSchema.optional().or(z.literal("")),
    password: passwordSchema,
    confirmPassword: z.string(),
    accountType: z.enum(["CUSTOMER", "WHOLESALE"]).default("CUSTOMER"),
    businessName: safeText(2, 120, "Business name").optional().or(z.literal("")),
    gstin: gstinSchema.optional().or(z.literal("")),
    acceptTerms: z.literal(true, {
      message: "You must accept the Terms and Privacy Policy",
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => d.accountType !== "WHOLESALE" || !!d.businessName, {
    message: "Business name is required for a wholesale account",
    path: ["businessName"],
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
  phone: phoneSchema.optional().or(z.literal("")),
  businessName: safeText(2, 120, "Business name").optional().or(z.literal("")),
  gstin: gstinSchema.optional().or(z.literal("")),
});

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

export const addressSchema = z.object({
  fullName: safeText(2, 80, "Full name"),
  phone: phoneSchema,
  line1: safeText(5, 150, "Address line 1"),
  line2: safeText(0, 150, "Address line 2").optional().or(z.literal("")),
  city: safeText(2, 60, "City"),
  state: safeText(2, 60, "State"),
  pincode: pincodeSchema,
  type: z.enum(["HOME", "WORK", "OTHER"]).default("HOME"),
  isDefault: z.coerce.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Catalog (admin)
// ---------------------------------------------------------------------------

export const categorySchema = z.object({
  name: safeText(2, 80, "Category name"),
  slug: slugSchema,
  description: safeText(0, 1000, "Description").optional().or(z.literal("")),
  imageUrl: z.string().max(500).optional().or(z.literal("")),
  parentId: cuidSchema.optional().or(z.literal("")),
  position: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.coerce.boolean().default(true),
  metaTitle: safeText(0, 70, "Meta title").optional().or(z.literal("")),
  metaDescription: safeText(0, 160, "Meta description").optional().or(z.literal("")),
});

export const productVariantSchema = z.object({
  id: cuidSchema.optional(),
  size: safeText(0, 30, "Size").optional().or(z.literal("")),
  color: safeText(0, 40, "Colour").optional().or(z.literal("")),
  sku: safeText(1, 60, "SKU"),
  stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
  priceDelta: z.coerce.number().min(-100000).max(100000).default(0)
    .transform((v) => Math.round(v * 100)),
});

export const productSchema = z
  .object({
    title: safeText(3, 160, "Product title"),
    slug: slugSchema,
    description: safeText(20, 8000, "Description"),
    shortDesc: safeText(0, 300, "Short description").optional().or(z.literal("")),
    categoryId: cuidSchema,
    priceRetail: priceSchema,
    mrp: priceSchema,
    priceWholesale: priceSchema.optional(),
    wholesaleMinQty: z.coerce.number().int().min(1).max(10000).default(10),
    sku: safeText(1, 60, "SKU"),
    stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
    fabric: safeText(0, 60, "Fabric").optional().or(z.literal("")),
    printType: safeText(0, 60, "Print type").optional().or(z.literal("")),
    workType: safeText(0, 60, "Work type").optional().or(z.literal("")),
    occasion: safeText(0, 60, "Occasion").optional().or(z.literal("")),
    washCare: safeText(0, 300, "Wash care").optional().or(z.literal("")),
    origin: safeText(0, 120, "Origin").optional().or(z.literal("")),
    isActive: z.coerce.boolean().default(true),
    isFeatured: z.coerce.boolean().default(false),
    isNew: z.coerce.boolean().default(true),
    metaTitle: safeText(0, 70, "Meta title").optional().or(z.literal("")),
    metaDescription: safeText(0, 160, "Meta description").optional().or(z.literal("")),
    keywords: safeText(0, 500, "Keywords").optional().or(z.literal("")),
    images: z
      .array(
        z.object({
          url: z.string().max(500),
          alt: safeText(0, 160, "Image alt text").optional().or(z.literal("")),
        }),
      )
      .max(12, "A product can have at most 12 images")
      .default([]),
    variants: z.array(productVariantSchema).max(60).default([]),
  })
  .refine((d) => d.mrp >= d.priceRetail, {
    message: "MRP must be greater than or equal to the selling price",
    path: ["mrp"],
  })
  .refine((d) => d.priceWholesale == null || d.priceWholesale <= d.priceRetail, {
    message: "Wholesale price must be lower than the retail price",
    path: ["priceWholesale"],
  });

// ---------------------------------------------------------------------------
// Cart & checkout
// ---------------------------------------------------------------------------

export const addToCartSchema = z.object({
  productId: cuidSchema,
  variantId: cuidSchema.optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(100),
});

export const updateCartSchema = z.object({
  cartItemId: cuidSchema,
  quantity: z.coerce.number().int().min(0).max(100),
});

export const checkoutSchema = z.object({
  addressId: cuidSchema,
  paymentMethod: z.enum(["COD", "UPI", "CARD", "NETBANKING"]),
  couponCode: safeText(0, 40, "Coupon code").optional().or(z.literal("")),
  customerNote: safeText(0, 500, "Note").optional().or(z.literal("")),
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
    description: safeText(0, 200, "Description").optional().or(z.literal("")),
    type: z.enum(["PERCENT", "FLAT"]),
    value: z.coerce.number().min(0).max(1_000_000),
    minOrderValue: priceSchema.default(0),
    maxDiscount: priceSchema.optional(),
    usageLimit: z.coerce.number().int().min(0).max(1_000_000).optional(),
    perUserLimit: z.coerce.number().int().min(1).max(1000).default(1),
    isActive: z.coerce.boolean().default(true),
    expiresAt: z.string().optional().or(z.literal("")),
    appliesTo: z.enum(["ALL", "RETAIL", "WHOLESALE"]).default("ALL"),
  })
  .refine((d) => d.type !== "PERCENT" || d.value <= 100, {
    message: "A percentage discount cannot exceed 100",
    path: ["value"],
  });

// ---------------------------------------------------------------------------
// Reviews & support
// ---------------------------------------------------------------------------

export const reviewSchema = z.object({
  productId: cuidSchema,
  rating: z.coerce.number().int().min(1, "Pick a rating").max(5),
  title: safeText(0, 100, "Title").optional().or(z.literal("")),
  comment: safeText(10, 2000, "Review"),
});

export const ticketSchema = z.object({
  subject: safeText(5, 150, "Subject"),
  category: z.enum(["ORDER", "PAYMENT", "RETURN", "PRODUCT", "WHOLESALE", "OTHER"]),
  orderNumber: safeText(0, 40, "Order number").optional().or(z.literal("")),
  message: safeText(10, 4000, "Message"),
});

export const ticketReplySchema = z.object({
  ticketId: cuidSchema,
  body: safeText(1, 4000, "Message"),
});

export const newsletterSchema = z.object({ email: emailSchema });

// ---------------------------------------------------------------------------
// Admin operations
// ---------------------------------------------------------------------------

export const orderStatusSchema = z.object({
  orderId: cuidSchema,
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "RETURNED",
  ]),
  trackingNumber: safeText(0, 60, "Tracking number").optional().or(z.literal("")),
  courierName: safeText(0, 60, "Courier").optional().or(z.literal("")),
  note: safeText(0, 500, "Note").optional().or(z.literal("")),
});

export const userRoleSchema = z.object({
  userId: cuidSchema,
  role: z.enum(["CUSTOMER", "WHOLESALE", "ADMIN"]),
  isApproved: z.coerce.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Storefront query params
// ---------------------------------------------------------------------------

export const productQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: slugSchema.optional(),
  minPrice: z.coerce.number().min(0).max(10_000_000).optional(),
  maxPrice: z.coerce.number().min(0).max(10_000_000).optional(),
  fabric: z.string().trim().max(60).optional(),
  occasion: z.string().trim().max(60).optional(),
  sort: z
    .enum(["newest", "price-asc", "price-desc", "popular", "rating"])
    .default("newest"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;
