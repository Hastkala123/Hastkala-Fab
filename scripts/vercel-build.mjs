/**
 * Vercel's build: check the settings, apply database migrations, build.
 *
 * A wrong DATABASE_URL otherwise shows up as a cryptic Prisma error. Here
 * each common mistake gets a plain explanation. Values are never printed —
 * only what kind of address it is.
 */
import { spawnSync } from "node:child_process";

const problems = [];
const warnings = [];

function describe(url) {
  const scheme = /^[a-z+]+:/i.exec(url)?.[0] ?? "(no protocol)";
  return `it starts with "${scheme}"`;
}

const raw = process.env.DATABASE_URL ?? "";
const url = raw.trim();
if (!url) {
  problems.push(
    "DATABASE_URL is not set. Create a database (Vercel → Storage → Create Database → Neon), connect it to this project, " +
      "or paste your PostgreSQL address in Settings → Environment Variables.",
  );
} else if (/^["']|["']$/.test(url)) {
  problems.push("DATABASE_URL has quote marks around it. In Vercel, paste the address without quotes.");
} else if (!/^postgres(ql)?:\/\//i.test(url)) {
  problems.push(
    `DATABASE_URL must be a PostgreSQL address starting with postgresql://, but ${describe(url)}.` +
      (url.startsWith("file:") ? " That is the old SQLite address from the Desktop copy of .env — don't use it." : ""),
  );
} else if (/@(localhost|127\.0\.0\.1)[:/]/i.test(url) || /\/\/(localhost|127\.0\.0\.1)[:/]/i.test(url)) {
  problems.push("DATABASE_URL points to localhost (a database on your own computer). Vercel needs a hosted one, such as Neon.");
}

for (const [name, min] of [["AUTH_SECRET", 32], ["IP_HASH_SALT", 16]]) {
  const value = process.env[name] ?? "";
  if (value.length < min) {
    problems.push(`${name} must be set to at least ${min} random characters (make one with: openssl rand -hex ${min}).`);
  }
}
if (!process.env.NEXT_PUBLIC_SITE_URL) {
  warnings.push("NEXT_PUBLIC_SITE_URL is not set: links in the sitemap will say localhost and search engines are told to stay away.");
}
if (!process.env.CRON_SECRET) {
  warnings.push("CRON_SECRET is not set: background work (unpaid-order expiry, payment checks) can't be triggered.");
}

for (const warning of warnings) console.warn(`⚠  ${warning}`);
if (problems.length) {
  console.error("\n✖ The build can't continue — fix these in Vercel → Settings → Environment Variables, then redeploy:\n");
  for (const problem of problems) console.error(`  • ${problem}`);
  console.error("");
  process.exit(1);
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Migrations go over a direct connection when the host offers one (Neon's
// pooled address can't hold the lock migrations take).
const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
run("npx", ["prisma", "migrate", "deploy"], direct ? { ...process.env, DATABASE_URL: direct } : process.env);
run("npx", ["next", "build"]);
