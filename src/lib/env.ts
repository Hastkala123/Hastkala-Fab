import { z } from "zod";

/**
 * Environment is validated once at boot. A missing or weak AUTH_SECRET is a
 * fatal error, not a warning — silently falling back to a default secret is how
 * production sites end up with forgeable session tokens.
 */
/** An empty value in .env counts as "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters of high-entropy random data"),
  IP_HASH_SALT: z.string().min(16, "IP_HASH_SALT must be at least 16 characters"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SITE_NAME: z.string().default("Hastkala Fab"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Payments (optional until Razorpay KYC is done; a test gateway stands in
  // during development and online payment is switched off in production).
  RAZORPAY_KEY_ID: optional(z.string().regex(/^rzp_(test|live)_[A-Za-z0-9]+$/, "RAZORPAY_KEY_ID must look like rzp_test_… or rzp_live_…")),
  RAZORPAY_KEY_SECRET: optional(z.string().min(10, "RAZORPAY_KEY_SECRET looks too short")),
  RAZORPAY_WEBHOOK_SECRET: optional(z.string().min(8, "RAZORPAY_WEBHOOK_SECRET looks too short")),

  // Background work: the cron route needs this bearer secret.
  CRON_SECRET: optional(z.string().min(32, "CRON_SECRET must be at least 32 characters")),
  /** "true" runs background work inside the web server (one-server hosting). On by default in development. */
  IN_PROCESS_SCHEDULER: optional(z.enum(["true", "false"])),
}).refine((e) => Boolean(e.RAZORPAY_KEY_ID) === Boolean(e.RAZORPAY_KEY_SECRET), {
  message: "Set both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or neither",
  path: ["RAZORPAY_KEY_SECRET"],
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  IP_HASH_SALT: process.env.IP_HASH_SALT,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
  NODE_ENV: process.env.NODE_ENV,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  IN_PROCESS_SCHEDULER: process.env.IN_PROCESS_SCHEDULER,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill in real values.`,
  );
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
