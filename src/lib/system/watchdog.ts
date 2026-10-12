// ============================================
// NEXUS DENTAL — Operations watchdog
//
// A worker cannot report its own death, so this runs OUTSIDE the worker process:
// it is invoked by an external scheduler through POST /api/system/watchdog (see
// .github/workflows/ops-watchdog.yml). It judges, from what the app can observe:
//   * worker health   - a fresh heartbeat that reports ALL required workers
//   * backup freshness - a valid encrypted backup within 26 h (src/lib/backup/validity.ts)
//   * restore drill age - a strict drill within 35 days
//   * dead-letter backlog - jobs that ran out of retries
// and raises rate-limited alerts. It is stateless: when the condition clears, the
// next evaluation is healthy again - there is nothing to reset.
// ============================================

import prisma from "@/lib/db/prisma";
import { queueRedisConnection } from "@/lib/queue/redis";
import { evaluateWorkerHealth, readHeartbeats, withTimeout, type WorkerHealth } from "@/lib/queue/heartbeat";
import { sendOpsAlert, type AlertOutcome } from "./alerts";
import { checkBackupsAndAlert, type BackupStatus } from "./backup-status";

export const DEAD_LETTER_ALERT_THRESHOLD = 5;

export type WatchdogIssue = "worker-stale" | "worker-incomplete" | "worker-unknown" | "backup" | "restore-drill" | "dead-letters";

export interface WatchdogResult {
    ok: boolean;
    issues: WatchdogIssue[];
    worker: { status: "UP" | "DOWN" | "UNKNOWN"; reason: WorkerHealth["reason"]; missingWorkers: string[] } | null;
    backup: BackupStatus | null;
    deadLetters: number | null;
    /** What happened to each alert: sent, suppressed (rate-limited), unconfigured, failed. */
    alerts: Record<string, AlertOutcome>;
}

export interface WatchdogOptions {
    now?: Date;
    /** The worker process runs its own hourly pass without checking itself. */
    checkWorkers?: boolean;
}

export async function runWatchdog(opts: WatchdogOptions = {}): Promise<WatchdogResult> {
    const now = opts.now ?? new Date();
    const checkWorkers = opts.checkWorkers !== false;
    const issues: WatchdogIssue[] = [];
    const alerts: Record<string, AlertOutcome> = {};
    let worker: WatchdogResult["worker"] = null;

    if (checkWorkers) {
        try {
            const beats = await withTimeout(readHeartbeats(queueRedisConnection), 3000, "heartbeats");
            const h = evaluateWorkerHealth(beats, now);
            worker = { status: h.status, reason: h.reason, missingWorkers: h.missingWorkers };
            if (h.status === "DOWN") {
                issues.push(h.reason === "incomplete" ? "worker-incomplete" : "worker-stale");
                alerts["worker-stale"] = await sendOpsAlert(
                    "worker-stale",
                    "The background worker is not running",
                    h.reason === "incomplete"
                        ? `The worker is alive but not running: ${h.missingWorkers.join(", ")}. Reminders and sweeps may not be processed.`
                        : "No fresh worker heartbeat was seen. Appointment reminders and scheduled sweeps are NOT being processed until the worker is running again.",
                    { now, minIntervalHours: 2 }
                );
            }
        } catch {
            // Cannot read Redis at all: the worker's state is unknown, which is itself an alert-worthy condition.
            worker = { status: "UNKNOWN", reason: null, missingWorkers: [] };
            issues.push("worker-unknown");
            alerts["worker-stale"] = await sendOpsAlert(
                "worker-stale",
                "Cannot confirm the background worker is running",
                "Redis could not be read, so the worker's heartbeat could not be checked.",
                { now, minIntervalHours: 2 }
            );
        }
    }

    let backup: BackupStatus | null = null;
    try {
        const checked = await checkBackupsAndAlert(now);
        backup = checked;
        if (checked.backup !== "ok") issues.push("backup");
        if (checked.drill !== "ok") issues.push("restore-drill");
        if (checked.alerts.backup) alerts["backup"] = checked.alerts.backup;
        if (checked.alerts.drill) alerts["restore-drill"] = checked.alerts.drill;
    } catch (error) {
        console.error("[Watchdog] backup check failed:", error instanceof Error ? error.message : "unknown");
        issues.push("backup");
    }

    let deadLetters: number | null = null;
    try {
        deadLetters = await withTimeout<number>(prisma.failedJob.count({ where: { retriedAt: null } }), 3000, "dead letters");
        if (deadLetters >= DEAD_LETTER_ALERT_THRESHOLD) {
            issues.push("dead-letters");
            alerts["dead-letters"] = await sendOpsAlert(
                "dead-letter-backlog",
                "Background jobs are failing",
                `${deadLetters} background jobs have run out of retries and need attention (System > Queues).`,
                { now }
            );
        }
    } catch {
        issues.push("dead-letters");
    }

    return { ok: issues.length === 0, issues, worker, backup, deadLetters, alerts };
}
