// ============================================
// NEXUS DENTAL — Redis-backed rate limiting
//
// Fixed-window counter shared by every server instance and preserved across
// restarts (the previous in-memory Map reset on every deploy and was
// per-instance, so it gave no real protection on autoscaled hosting).
//
// Fails OPEN if Redis is unreachable: a cache outage must not lock the whole
// clinic out of signing in. The failure is logged loudly so it is visible in
// monitoring rather than silently disabling protection.
// ============================================

import redis from "@/lib/db/redis";

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    /** Seconds until the window resets (only meaningful when blocked). */
    retryAfterSeconds: number;
}

/**
 * Count one attempt against `key` and report whether it is within `limit`
 * attempts per `windowSeconds`.
 */
export async function consumeRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
): Promise<RateLimitResult> {
    const redisKey = `rl:${key}`;
    try {
        const count = await redis.incr(redisKey);
        if (count === 1) {
            await redis.expire(redisKey, windowSeconds);
        }

        if (count > limit) {
            const ttl = await redis.ttl(redisKey);
            return {
                allowed: false,
                remaining: 0,
                retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
            };
        }

        return { allowed: true, remaining: Math.max(0, limit - count), retryAfterSeconds: 0 };
    } catch (err) {
        console.error("[RateLimit] Redis unavailable — failing open for key prefix:", key.split(":")[0], err);
        return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
    }
}

/** Forget a key, e.g. after a successful login so honest users aren't penalised. */
export async function resetRateLimit(key: string): Promise<void> {
    try {
        await redis.del(`rl:${key}`);
    } catch {
        // best effort
    }
}

/** Best-effort client IP from proxy headers (App Hosting / Cloud Run set x-forwarded-for). */
export function clientIp(headers: Headers): string {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return headers.get("x-real-ip") ?? "unknown";
}
