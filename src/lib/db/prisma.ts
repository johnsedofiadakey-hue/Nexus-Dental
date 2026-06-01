import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { withAuditLogging } from "./prisma-extension";

const { Pool } = pg;

const globalForPrisma = globalThis as unknown as {
    prisma: ReturnType<typeof withAuditLogging> | undefined;
};

function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        console.warn("DATABASE_URL is not set. Using Prisma Proxy.");
        return new Proxy({}, { get: () => new Proxy({}, { get: () => () => Promise.resolve([]) }) }) as any;
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    const baseClient = new PrismaClient({
        adapter,
        log:
            process.env.NODE_ENV === "development"
                ? ["query", "error", "warn"]
                : ["error"],
    });
    
    return withAuditLogging(baseClient);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

export default prisma;
