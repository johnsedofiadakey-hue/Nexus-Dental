// ============================================
// NEXUS DENTAL — System Health Service
// Connectivity and resource monitoring
// ============================================

import prisma from "@/lib/db/prisma";
import { queueRedisConnection } from "@/lib/queue/redis";
import { getQueue } from "@/lib/queue/queues";

export interface HealthReport {
    status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
    timestamp: string;
    services: {
        database: { status: "UP" | "DOWN"; latencyMs: number };
        redis: { status: "UP" | "DOWN" };
        workers: {
            notification: { waiting: number; active: number };
            appointment: { waiting: number; active: number };
        };
    };
}

/**
 * Generate a comprehensive health report.
 */
export async function getSystemHealth(): Promise<HealthReport> {
    const start = Date.now();
    let dbStatus: "UP" | "DOWN" = "UP";
    let dbLatency = 0;

    try {
        await prisma.$queryRaw`SELECT 1`;
        dbLatency = Date.now() - start;
    } catch {
        dbStatus = "DOWN";
    }

    let redisStatus: "UP" | "DOWN" = "UP";
    try {
        await queueRedisConnection.ping();
    } catch {
        redisStatus = "DOWN";
    }

    const nQueue = getQueue("notification-queue");
    const aQueue = getQueue("appointment-queue");

    const [nw, na, aw, aa] = await Promise.all([
        nQueue.getWaitingCount(),
        nQueue.getActiveCount(),
        aQueue.getWaitingCount(),
        aQueue.getActiveCount(),
    ]);

    const isHealthy = dbStatus === "UP" && redisStatus === "UP";

    return {
        status: isHealthy ? "HEALTHY" : "UNHEALTHY",
        timestamp: new Date().toISOString(),
        services: {
            database: { status: dbStatus, latencyMs: dbLatency },
            redis: { status: redisStatus },
            workers: {
                notification: { waiting: nw, active: na },
                appointment: { waiting: aw, active: aa },
            },
        },
    };
}
