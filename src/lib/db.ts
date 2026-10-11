import { PrismaClient } from "@prisma/client";
import { isProd } from "./env";

/**
 * In dev, Next.js hot-reload re-evaluates modules on every edit. Without this
 * global cache each reload would open a new pool and exhaust DB connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ["error"] : ["error", "warn"],
  });

if (!isProd) globalForPrisma.prisma = db;
