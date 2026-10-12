// ============================================
// NEXUS DENTAL — Background worker process
//
// Runs the BullMQ workers, the recurring schedules and the operations watchdog
// OUTSIDE the scale-to-zero web service, so reminders and sweeps run whether or
// not anyone is visiting the site. Start with `npm run worker`.
//
// Fails closed on bad configuration, exits non-zero on fatal errors, shuts down
// gracefully on SIGTERM/SIGINT. Safe to run more than once: schedules are upserted
// by id, jobs are claimed atomically by BullMQ, and alerts are rate-limited in
// the database.
// ============================================

import os from "os";
import { enforceStartupConfig, ConfigError } from "@/lib/config/validate";
import { getClinicId } from "@/lib/clinic";

const WATCHDOG_INTERVAL_MS = 60 * 60 * 1000;
const SHUTDOWN_TIMEOUT_MS = 6000;

async function main() {
    try {
        enforceStartupConfig(process.env);
    } catch (error) {
        if (error instanceof ConfigError) {
            console.error(`[Worker] Refusing to start. ${error.message}`);
            process.exit(1);
        }
        throw error;
    }

    // Imported only after configuration is known good: these modules open Redis connections.
    const { queueRedisConnection } = await import("@/lib/queue/redis");
    const { recallQueue, insuranceQueue, appointmentQueue } = await import("@/lib/queue/queues");
    const { registerWorker, shutdownWorkers, getWorkerStatus } = await import("@/lib/queue/manager");
    const { startHeartbeat, withTimeout } = await import("@/lib/queue/heartbeat");
    const { registerSchedules } = await import("./schedules");
    const { startHealthServer } = await import("./health");
    const prisma = (await import("@/lib/db/prisma")).default;
    const { runWatchdog } = await import("@/lib/system/watchdog");
    const { reconcileReminders } = await import("@/lib/reminders/reconcile");

    const appointment = (await import("@/lib/queue/workers/appointment.worker")).appointmentWorker;
    const notification = (await import("@/lib/queue/workers/notification.worker")).notificationWorker;
    const recall = (await import("@/lib/queue/workers/recall.worker")).recallWorker;
    const insurance = (await import("@/lib/queue/workers/insurance-reminder.worker")).insuranceReminderWorker;
    registerWorker("appointment", appointment);
    registerWorker("notification", notification);
    registerWorker("recall", recall);
    registerWorker("insurance-reminder", insurance);

    const instance = `${os.hostname()}-${process.pid}`;
    const stopHeartbeat = startHeartbeat(queueRedisConnection, instance, () => getWorkerStatus().activeWorkers);

    const port = Number(process.env.WORKER_HEALTH_PORT ?? process.env.PORT ?? 8081);
    const server = startHealthServer(port, async () => {
        await queueRedisConnection.ping();
        await prisma.$queryRaw`SELECT 1`;
    });

    // Declared early so shutdown can clear them; each is assigned exactly once, after startup.
    // eslint-disable-next-line prefer-const
    let reconcileTimer: NodeJS.Timeout | undefined;
    // eslint-disable-next-line prefer-const
    let watchdogTimer: NodeJS.Timeout | undefined;
    let stopping = false;
    const shutdown = async (signal: string) => {
        if (stopping) return;
        stopping = true;
        console.log(`[Worker] ${signal} received, shutting down...`);
        if (watchdogTimer) clearInterval(watchdogTimer);
        if (reconcileTimer) clearInterval(reconcileTimer);
        stopHeartbeat();
        server.close();
        // Bounded: if Redis is unreachable, closing workers would wait for it forever, and the
        // platform SIGKILLs a slow shutdown after ~10 s anyway. Finish what we can, then exit.
        await withTimeout(shutdownWorkers(), SHUTDOWN_TIMEOUT_MS, "worker shutdown").catch((e: Error) => console.error(`[Worker] ${e.message}; exiting anyway`));
        await withTimeout(queueRedisConnection.quit(), 1000, "redis quit").catch(() => {});
        process.exit(0);
    };
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));

    // Liveness is up BEFORE anything that waits on Redis, so a Redis outage shows as
    // "alive but not ready" to the platform instead of looking like a crashed process.
    const scheduleIds = await registerSchedules({ recall: recallQueue, insurance: insuranceQueue }, getClinicId());
    console.log(`[Worker] Schedules registered: ${scheduleIds.join(", ")}`);

    // The database is the source of truth for reminders; queue jobs are rebuilt from it every minute
    // (repairs a Redis outage during booking, a flushed Redis, or a lost job). Idempotent by job id.
    const reconcile = async () => {
        try {
            const r = await reconcileReminders({ db: prisma, queue: appointmentQueue });
            if (r.enqueued > 0 || r.failed > 0) console.log(`[Worker] Reminder reconcile: ${r.enqueued} (re)queued, ${r.failed} failed, ${r.checked} checked`);
        } catch (error) {
            console.error("[Worker] Reminder reconcile error:", error instanceof Error ? error.message : "unknown");
        }
    };
    void reconcile();
    reconcileTimer = setInterval(reconcile, 60_000);

    // The worker's own hourly pass covers backups, drills and dead letters. It deliberately does NOT
    // judge worker health: a worker cannot report its own death. That is the external watchdog
    // (POST /api/system/watchdog, .github/workflows/ops-watchdog.yml).
    const watchdog = async () => {
        try {
            await runWatchdog({ checkWorkers: false });
        } catch (error) {
            console.error("[Worker] Watchdog error:", error instanceof Error ? error.message : "unknown");
        }
    };
    void watchdog();
    watchdogTimer = setInterval(watchdog, WATCHDOG_INTERVAL_MS);

    console.log(`[Worker] Running (instance ${instance}, health on :${port})`);
}

main().catch((error) => {
    console.error("[Worker] Fatal:", error instanceof Error ? error.message : "unknown");
    process.exit(1);
});
