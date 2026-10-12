// ============================================
// NEXUS DENTAL — Public Health Check
// GET /api/health — unauthenticated liveness/degradation check for uptime monitors.
//
// Always answers within ~2 s, even when Redis or the database is unreachable
// (every dependency check is time-bounded), so a dependency outage can never make
// the probe itself hang. Deliberately coarse: no latency, queue internals, counts
// or timestamps. HTTP 503 only when the database or Redis is down; a stale
// backup or a stopped worker answers 200 with status "degraded" so a load
// balancer does not pull a working site out of rotation, while an uptime monitor
// that watches the body still sees it.
// Detail for the system owner: GET /api/system/health.
// ============================================

import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { queueRedisConnection } from "@/lib/queue/redis";
import { evaluateWorkerHealth, readHeartbeats, withTimeout } from "@/lib/queue/heartbeat";
import { getBackupStatus } from "@/lib/system/backup-status";

export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 1500;
const REDIS_TIMEOUT_MS = 1000;

export async function GET() {
    const [dbUp, redisUp] = await Promise.all([
        withTimeout(Promise.resolve(prisma.$queryRaw`SELECT 1`), DB_TIMEOUT_MS, "database").then(() => true, () => false),
        withTimeout(queueRedisConnection.ping(), REDIS_TIMEOUT_MS, "redis").then(() => true, () => false),
    ]);

    if (!dbUp || !redisUp) {
        return NextResponse.json({ status: "degraded" }, { status: 503 });
    }

    const workers = await withTimeout(readHeartbeats(queueRedisConnection), REDIS_TIMEOUT_MS, "heartbeats").then(
        (beats) => (evaluateWorkerHealth(beats).status === "UP" ? "ok" : "down"),
        () => "unknown"
    );
    const backup = await withTimeout(getBackupStatus(), DB_TIMEOUT_MS, "backup status").then(
        (s) => s.backup,
        () => "unknown"
    );

    const healthy = workers === "ok" && backup === "ok";
    return NextResponse.json({ status: healthy ? "ok" : "degraded", workers, backup }, { status: 200 });
}
