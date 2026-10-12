/**
 * Points every Prisma client at the test database. Runs before each test
 * file imports anything, so `@/lib/db` never sees the development database.
 */
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !/test/i.test(testUrl)) {
  throw new Error("TEST_DATABASE_URL must be set and must name a test database (it is wiped by the tests).");
}
process.env.DATABASE_URL = testUrl;

// Payments always go through the built-in test gateway in tests, even if
// real Razorpay keys are in .env — the tests must never call Razorpay.
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;
delete process.env.RAZORPAY_WEBHOOK_SECRET;
