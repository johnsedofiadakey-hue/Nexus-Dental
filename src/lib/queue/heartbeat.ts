// ============================================
// NEXUS DENTAL — Worker heartbeat
//
// The worker process writes a short-lived key to Redis every 30 s. If nothing
// has written one for 90 s the worker is, for every practical purpose, dead -
// and the web app, /api/health and the watchdog can say so.
// ============================================

import type { Redis } from "ioredis";

export const HEARTBEAT_PREFIX = "nexus:worker:heartbeat:";
export const HEARTBEAT_INTERVAL_MS = 30_000;

/** The workers a healthy worker process must be running. `registerWorker` names; keep in sync with src/worker/index.ts. */
export const REQUIRED_WORKERS = ["appointment", "notification", "recall", "insurance-reminder"] as const;
export const HEARTBEAT_TTL_SECONDS = 90;

export type RedisLike = Pick<Redis, "set" | "scan" | "get">;

export function startHeartbeat(redis: RedisLike, instance: string, workers: () => string[]): () => void {
    const beat = () =>
        redis
            .set(`${HEARTBEAT_PREFIX}${instance}`, JSON.stringify({ at: new Date().toISOString(), workers: workers() }), "EX", HEARTBEAT_TTL_SECONDS)
            .catch((e: Error) => console.error("[Worker] heartbeat failed:", e.message));
    void beat();
    const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    timer.unref?.();
    return () => clearInterval(timer);
}

export interface WorkerHeartbeat {
    instance: string;
    at: string;
    workers: string[];
}

export async function readHeartbeats(redis: RedisLike): Promise<WorkerHeartbeat[]> {
    const out: WorkerHeartbeat[] = [];
    let cursor = "0";
    do {
        const [next, keys] = await redis.scan(cursor, "MATCH", `${HEARTBEAT_PREFIX}*`, "COUNT", 100);
        cursor = next;
        for (const key of keys) {
            const raw = await redis.get(key);
            if (!raw) continue;
            try {
                const v = JSON.parse(raw) as { at: string; workers: string[] };
                out.push({ instance: key.slice(HEARTBEAT_PREFIX.length), at: v.at, workers: v.workers });
            } catch {
                /* a corrupt heartbeat counts as no heartbeat */
            }
        }
    } while (cursor !== "0");
    return out;
}

/** Fail fast: a Redis outage must produce an answer, not a hang. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export interface WorkerHealth {
    /** UP only when ONE fresh heartbeat reports ALL required workers. */
    status: "UP" | "DOWN";
    /** Why it is DOWN: no heartbeat, only stale ones, or a live process missing some workers. */
    reason: "none" | "stale" | "incomplete" | null;
    missingWorkers: string[];
    freshInstances: number;
}

/** The single definition of "the worker is healthy", shared by /api/health, /api/system/health and the watchdog. */
export function evaluateWorkerHealth(beats: WorkerHeartbeat[], now: Date = new Date()): WorkerHealth {
    if (beats.length === 0) return { status: "DOWN", reason: "none", missingWorkers: [...REQUIRED_WORKERS], freshInstances: 0 };
    const fresh = beats.filter((b) => {
        const at = new Date(b.at).getTime();
        return Number.isFinite(at) && now.getTime() - at < HEARTBEAT_TTL_SECONDS * 1000;
    });
    if (fresh.length === 0) return { status: "DOWN", reason: "stale", missingWorkers: [...REQUIRED_WORKERS], freshInstances: 0 };
    const complete = fresh.find((b) => REQUIRED_WORKERS.every((w) => b.workers.includes(w)));
    if (complete) return { status: "UP", reason: null, missingWorkers: [], freshInstances: fresh.length };
    // Report what the best live instance is missing.
    const best = fresh.reduce((a, b) => (b.workers.length > a.workers.length ? b : a));
    return { status: "DOWN", reason: "incomplete", missingWorkers: REQUIRED_WORKERS.filter((w) => !best.workers.includes(w)), freshInstances: fresh.length };
}
