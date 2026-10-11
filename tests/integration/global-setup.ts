import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

/** Brings the test database schema up to date once per run. */
export default function setup() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/test/i.test(url)) {
    throw new Error("TEST_DATABASE_URL must be set and must name a test database.");
  }
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}
