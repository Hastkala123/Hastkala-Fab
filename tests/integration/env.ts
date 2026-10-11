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
