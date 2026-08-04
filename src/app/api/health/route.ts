// ============================================
// NEXUS DENTAL — Public Health Check
// GET /api/health — unauthenticated liveness check for uptime monitors
// (e.g. UptimeRobot). Deliberately minimal: no latency numbers, no queue
// internals, no stack traces — just enough to alert on a real outage.
//
// For the detailed, staff-facing report (DB latency, queue depth, worker
// registry) see the authenticated GET /api/system/health instead.
// ============================================

import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { queueRedisConnection } from "@/lib/queue/redis";

export async function GET() {
    let dbUp = true;
    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch {
        dbUp = false;
    }

    let redisUp = true;
    try {
        await queueRedisConnection.ping();
    } catch {
        redisUp = false;
    }

    if (dbUp && redisUp) {
        return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    return NextResponse.json({ status: "degraded" }, { status: 503 });
}
