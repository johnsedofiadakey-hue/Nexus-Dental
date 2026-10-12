// ============================================
// NEXUS DENTAL — System Health Service
// Connectivity, worker and backup monitoring (system owner view).
// Every dependency call is time-bounded so an outage yields an answer, not a hang.
// ============================================

import prisma from "@/lib/db/prisma";
import { queueRedisConnection } from "@/lib/queue/redis";
import { getQueue, type QueueName } from "@/lib/queue/queues";
import { evaluateWorkerHealth, readHeartbeats, withTimeout, type WorkerHeartbeat, type WorkerHealth } from "@/lib/queue/heartbeat";
import { getBackupStatus, type BackupStatus } from "./backup-status";

export interface QueueHealth {
    name: QueueName;
    counts: { waiting: number; active: number; delayed: number; failed: number };
    oldestWaitingAgeSeconds: number | null;
}

export interface HealthReport {
    status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
    timestamp: string;
    services: {
        database: { status: "UP" | "DOWN"; latencyMs: number };
        redis: { status: "UP" | "DOWN" };
    };
    workers: { status: "UP" | "DOWN" | "UNKNOWN"; heartbeats: WorkerHeartbeat[]; staleAfterSeconds: number; detail: WorkerHealth | null };
    queues: QueueHealth[];
    deadLetters: { unresolved: number };
    backup: BackupStatus | null;
}

export const QUEUE_NAMES: QueueName[] = ["notification-queue", "appointment-queue", "recall-queue", "insurance-queue"];
const HEARTBEAT_STALE_SECONDS = 90;

async function queueHealth(name: QueueName): Promise<QueueHealth> {
    const queue = getQueue(name);
    const [counts, oldest] = await Promise.all([
        queue.getJobCounts("waiting", "active", "delayed", "failed"),
        queue.getWaiting(0, 0),
    ]);
    return {
        name,
        counts: { waiting: counts.waiting ?? 0, active: counts.active ?? 0, delayed: counts.delayed ?? 0, failed: counts.failed ?? 0 },
        oldestWaitingAgeSeconds: oldest[0]?.timestamp ? Math.max(0, Math.round((Date.now() - oldest[0].timestamp) / 1000)) : null,
    };
}

export async function getSystemHealth(): Promise<HealthReport> {
    const start = Date.now();
    let dbStatus: "UP" | "DOWN" = "UP";
    let dbLatency = 0;
    try {
        await withTimeout(Promise.resolve(prisma.$queryRaw`SELECT 1`), 1500, "database");
        dbLatency = Date.now() - start;
    } catch {
        dbStatus = "DOWN";
    }

    let redisStatus: "UP" | "DOWN" = "UP";
    try {
        await withTimeout(queueRedisConnection.ping(), 1000, "redis");
    } catch {
        redisStatus = "DOWN";
    }

    let heartbeats: WorkerHeartbeat[] = [];
    let queues: QueueHealth[] = [];
    let workerStatus: "UP" | "DOWN" | "UNKNOWN" = "UNKNOWN";
    let workerDetail: WorkerHealth | null = null;
    if (redisStatus === "UP") {
        try {
            heartbeats = await withTimeout(readHeartbeats(queueRedisConnection), 1500, "heartbeats");
            workerDetail = evaluateWorkerHealth(heartbeats);
            workerStatus = workerDetail.status;
            queues = await withTimeout(Promise.all(QUEUE_NAMES.map(queueHealth)), 3000, "queues");
        } catch {
            /* leave what we have; status below reflects it */
        }
    }

    const deadLetters: number = dbStatus === "UP"
        ? await withTimeout<number>(prisma.failedJob.count({ where: { retriedAt: null } }), 1500, "dead letters").catch(() => -1)
        : -1;
    const backup = dbStatus === "UP" ? await withTimeout(getBackupStatus(), 1500, "backup status").catch(() => null) : null;

    const critical = dbStatus === "UP" && redisStatus === "UP";
    const attention = workerStatus !== "UP" || backup?.backup !== "ok" || deadLetters > 0;

    return {
        status: !critical ? "UNHEALTHY" : attention ? "DEGRADED" : "HEALTHY",
        timestamp: new Date().toISOString(),
        services: { database: { status: dbStatus, latencyMs: dbLatency }, redis: { status: redisStatus } },
        workers: { status: workerStatus, heartbeats, staleAfterSeconds: HEARTBEAT_STALE_SECONDS, detail: workerDetail },
        queues,
        deadLetters: { unresolved: Math.max(deadLetters, 0) },
        backup,
    };
}
