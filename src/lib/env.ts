import { z } from "zod";

/**
 * Environment is validated once at boot. A missing or weak AUTH_SECRET is a
 * fatal error, not a warning — silently falling back to a default secret is how
 * production sites end up with forgeable session tokens.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters of high-entropy random data"),
  IP_HASH_SALT: z.string().min(16, "IP_HASH_SALT must be at least 16 characters"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SITE_NAME: z.string().default("Hastkala Fab"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  IP_HASH_SALT: process.env.IP_HASH_SALT,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
  NODE_ENV: process.env.NODE_ENV,
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
