// ============================================
// NEXUS DENTAL — Reminder reconciliation
//
// The database is the source of truth; queue jobs are an accelerator. Every minute the
// worker asks: which reminders are still PENDING and due within the next two hours (or
// recently overdue) - and makes sure each has a queue job. Adding a job with a stable job
// id is idempotent, so this can run as often as needed and from several replicas.
// It repairs: a Redis outage during booking, a flushed Redis, a job lost in a crash.
// ============================================

import type { ReminderJobData } from "./constants";
import { enqueueReminderJob, type ReminderRow } from "./schedule";

export const RECONCILE_LOOKAHEAD_MS = 2 * 3600_000;
export const RECONCILE_LOOKBACK_MS = 60 * 60_000;

export async function reconcileReminders(args: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: any;
    queue: { add(name: string, data: ReminderJobData, opts: { jobId: string; delay: number }): Promise<unknown> };
    now?: Date;
}): Promise<{ checked: number; enqueued: number; failed: number }> {
    const now = args.now ?? new Date();
    const rows: ReminderRow[] = await args.db.appointmentReminder.findMany({
        where: {
            status: "PENDING", // FAILED ones belong to the queue's retry policy and then the dead-letter list
            scheduledFor: { lte: new Date(now.getTime() + RECONCILE_LOOKAHEAD_MS), gte: new Date(now.getTime() - RECONCILE_LOOKBACK_MS) },
            appointmentAt: { gt: now },
        },
        take: 500,
    });
    let enqueued = 0;
    let failed = 0;
    for (const row of rows) {
        try {
            await enqueueReminderJob(args.queue, row, now);
            enqueued++;
        } catch {
            failed++;
        }
    }
    return { checked: rows.length, enqueued, failed };
}
