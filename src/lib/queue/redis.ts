// ============================================
// NEXUS DENTAL — Queue Redis Connection
// ioredis connection factory for BullMQ
// ============================================

import { Redis } from "ioredis";

/**
 * Shared Redis connection for BullMQ.
 * BullMQ requires `maxRetriesPerRequest` to be null for the connection
 * used by Workers and QueueEvents.
 */
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const queueRedisConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    // Ensure we don't block the event loop on exit
    lazyConnect: true,
});

queueRedisConnection.on("error", (error) => {
    console.error("[Queue] Redis connection error:", error);
});

queueRedisConnection.on("connect", () => {
    console.log("[Queue] Redis connected successfully");
});
