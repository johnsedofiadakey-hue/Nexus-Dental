// ============================================
// NEXUS DENTAL — Recurring job schedules
//
// Registered by the worker process, idempotently: each schedule has a fixed id,
// and BullMQ upserts by id, so restarting the worker or running several replicas
// never duplicates a schedule. (Appointment reminders are not here: they are
// delayed jobs created at booking time.)
// ============================================

import type { Queue } from "bullmq";

export interface ScheduleSpec {
    id: string;
    queue: "recall" | "insurance";
    pattern: string; // cron, evaluated in `tz`
    jobName: string;
    data: (tenantId: string) => Record<string, unknown>;
}

export const SCHEDULE_TZ = "UTC";

export const SCHEDULES: readonly ScheduleSpec[] = [
    { id: "schedule:recall:routine-checkup", queue: "recall", pattern: "0 9 * * *", jobName: "routine-checkup", data: (tenantId) => ({ tenantId, recallType: "ROUTINE_CHECKUP" }) },
    { id: "schedule:insurance:stale-claims", queue: "insurance", pattern: "0 8 * * *", jobName: "stale-claims", data: (tenantId) => ({ tenantId }) },
];

export async function registerSchedules(queues: { recall: Queue; insurance: Queue }, tenantId: string): Promise<string[]> {
    const ids: string[] = [];
    for (const spec of SCHEDULES) {
        await queues[spec.queue].upsertJobScheduler(
            spec.id,
            { pattern: spec.pattern, tz: SCHEDULE_TZ },
            { name: spec.jobName, data: spec.data(tenantId) }
        );
        ids.push(spec.id);
    }
    return ids;
}
