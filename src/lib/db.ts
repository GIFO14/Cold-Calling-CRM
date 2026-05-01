import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

const requiredDelegates = ["businessSettings", "pipelineStage", "callScript", "callScriptSession"] as const;
const missingDelegates = requiredDelegates.filter((delegate) => !(delegate in prisma));

if (missingDelegates.length > 0) {
  throw new Error(
    `Prisma client is out of date. Missing delegates: ${missingDelegates.join(", ")}. Regenerate the client and restart Next.js. If "next dev" is already running, stop that process first so Turbopack drops its stale cache.`
  );
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
