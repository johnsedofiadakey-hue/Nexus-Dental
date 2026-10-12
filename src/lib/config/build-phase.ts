// ============================================
// NEXUS DENTAL — Build-phase detection
// Dependency-free on purpose: it is imported by queue and worker modules that
// must not open any network connection while `next build` collects page data.
// ============================================

/**
 * True while `next build` is running (including page-data collection, which
 * imports route modules). Runtime services — Redis, BullMQ queues and workers,
 * Sentry — must not be started or connected in this phase.
 *
 * Next.js sets NEXT_PHASE explicitly; this replaces the earlier heuristic
 * (`NODE_ENV === "production" && !REDIS_URL`), which was false whenever
 * REDIS_URL was present and so let a build connect to a real Redis.
 */
export function isBuildPhase(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.NEXT_PHASE === "phase-production-build";
}
