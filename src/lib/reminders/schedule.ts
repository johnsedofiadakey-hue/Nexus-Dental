// ============================================
// NEXUS DENTAL — Planning, scheduling and cancelling reminders
//
// Durable first: the reminder rows (appointment_reminders) are written in the same
// transaction as the appointment. Queue jobs are only an accelerator and are rebuilt
// from the rows by reconcileReminders(), so a Redis outage or flush loses nothing.
// There is currently NO appointment-reschedule API; when one is added it must call
// cancelPendingReminders() then scheduleAppointmentReminders() with the new time.
// ============================================

import { redactText } from "@/lib/utils/redact";
import {
    APPOINTMENT_QUEUE_JOB,
    REMINDER_OFFSETS,
    reminderJobId,
    type ReminderJobData,
    type ReminderOffset,
} from "./constants";

export interface PlannedReminder {
    offsetMinutes: ReminderOffset;
    scheduledFor: Date;
    /** True when the due time is already in the past: nothing is created for it. */
    skippedPast: boolean;
}

/**
 *   > 60 min away: both reminders      30-60 min away: only the 30-minute one
 *   <= 30 min away: neither (they would be in the past)
 * A reminder exactly due now is treated as past (it cannot be sent "before" the appointment usefully).
 */
export function planReminders(appointmentAt: Date, now: Date = new Date()): PlannedReminder[] {
    return REMINDER_OFFSETS.map((offsetMinutes) => {
        const scheduledFor = new Date(appointmentAt.getTime() - offsetMinutes * 60_000);
        return { offsetMinutes, scheduledFor, skippedPast: scheduledFor.getTime() <= now.getTime() };
    });
}

/** Rows to nest inside `prisma.appointment.create({ data: { reminders: { create: … } } })`. */
export function reminderCreateData(tenantId: string, appointmentAt: Date, now: Date = new Date()) {
    return planReminders(appointmentAt, now)
        .filter((p) => !p.skippedPast)
        .map((p) => ({ tenantId, offsetMinutes: p.offsetMinutes, appointmentAt, scheduledFor: p.scheduledFor }));
}

// ── Truthful summary returned to API callers ──────────────────────────────────

export type ReminderItemStatus =
    | "PENDING" // durable row written AND queue job added
    | "NOT_QUEUED" // durable row written, queue job could not be added; the reconciler will retry
    | "SKIPPED_PAST" // already in the past: not created
    | "FAILED"; // could not be recorded

export interface ReminderSummaryItem {
    offsetMinutes: ReminderOffset;
    scheduledFor: string;
    status: ReminderItemStatus;
}

export interface RemindersScheduled {
    /** The clinic setting and an SMS provider both allow reminders. */
    enabled: boolean;
    /** Why reminders were not scheduled (disabled / provider unavailable), when `enabled` is false. */
    reason?: string;
    timeZone: string;
    /** True only if every reminder that SHOULD exist is recorded AND queued. */
    complete: boolean;
    items: ReminderSummaryItem[];
}

interface QueueLike {
    add(name: string, data: ReminderJobData, opts: { jobId: string; delay: number }): Promise<unknown>;
}

export interface ReminderRow {
    id: string;
    tenantId: string;
    appointmentId: string;
    offsetMinutes: number;
    scheduledFor: Date;
    generation: number;
}

/** Add the delayed queue job for one durable reminder. Idempotent: the job id is stable. */
export async function enqueueReminderJob(queue: QueueLike, row: ReminderRow, now: Date = new Date()): Promise<void> {
    await queue.add(
        APPOINTMENT_QUEUE_JOB,
        { type: "REMINDER", reminderId: row.id, appointmentId: row.appointmentId, tenantId: row.tenantId },
        { jobId: reminderJobId(row.id, row.generation), delay: Math.max(0, row.scheduledFor.getTime() - now.getTime()) }
    );
}

/** Summarise what booking just did, from the durable rows and the queue outcome. Nothing is assumed. */
export async function enqueueAndSummarise(args: {
    rows: ReminderRow[];
    appointmentAt: Date;
    queue: QueueLike;
    timeZone: string;
    now?: Date;
    onQueueError?: (error: unknown) => void;
}): Promise<RemindersScheduled> {
    const now = args.now ?? new Date();
    const items: ReminderSummaryItem[] = [];
    for (const p of planReminders(args.appointmentAt, now)) {
        if (p.skippedPast) {
            items.push({ offsetMinutes: p.offsetMinutes, scheduledFor: p.scheduledFor.toISOString(), status: "SKIPPED_PAST" });
            continue;
        }
        const row = args.rows.find((r) => r.offsetMinutes === p.offsetMinutes);
        if (!row) {
            items.push({ offsetMinutes: p.offsetMinutes, scheduledFor: p.scheduledFor.toISOString(), status: "FAILED" });
            continue;
        }
        try {
            await enqueueReminderJob(args.queue, row, now);
            items.push({ offsetMinutes: p.offsetMinutes, scheduledFor: p.scheduledFor.toISOString(), status: "PENDING" });
        } catch (error) {
            args.onQueueError?.(error);
            items.push({ offsetMinutes: p.offsetMinutes, scheduledFor: p.scheduledFor.toISOString(), status: "NOT_QUEUED" });
        }
    }
    return { enabled: true, timeZone: args.timeZone, items, complete: items.every((i) => i.status === "PENDING" || i.status === "SKIPPED_PAST") };
}

/** Summary for "reminders are off" (clinic switch or no provider): nothing was scheduled, and we say so. */
export function remindersDisabledSummary(reason: string | undefined, timeZone: string): RemindersScheduled {
    return { enabled: false, reason, timeZone, items: [], complete: true };
}

// ── Cancellation and re-creation ──────────────────────────────────────────────

interface ReminderDb {
    appointmentReminder: {
        updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
        findMany(args: { where: Record<string, unknown> }): Promise<ReminderRow[]>;
        upsert(args: any): Promise<ReminderRow>; // eslint-disable-line @typescript-eslint/no-explicit-any
    };
}

/**
 * Mark every not-yet-sent reminder of an appointment CANCELLED, inside the caller's transaction.
 * (The worker also re-checks the appointment's status itself, so this is belt and braces.)
 */
export async function cancelPendingReminders(db: ReminderDb, appointmentId: string, reason: string): Promise<number> {
    const { count } = await db.appointmentReminder.updateMany({
        where: { appointmentId, status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
        data: { status: "CANCELLED", lastError: redactText(reason, 120), claimToken: null, claimedAt: null },
    });
    return count;
}

/** Best-effort removal of queued jobs for cancelled reminders (the worker would skip them anyway). */
export async function removeQueuedJobs(queue: { remove(jobId: string): Promise<unknown> }, rows: Array<Pick<ReminderRow, "id" | "generation">>): Promise<void> {
    await Promise.all(rows.map((r) => queue.remove(reminderJobId(r.id, r.generation)).catch(() => {})));
}

/**
 * (Re)create reminders for an existing appointment, e.g. after it is reopened or - in future -
 * rescheduled. A cancelled row for the SAME appointment time is revived with a new generation
 * (so its queue job id is new); otherwise a new row is created. Returns the rows to enqueue.
 */
export async function scheduleAppointmentReminders(
    db: ReminderDb,
    appointment: { id: string; tenantId: string; dateTime: Date },
    now: Date = new Date()
): Promise<ReminderRow[]> {
    for (const p of planReminders(appointment.dateTime, now)) {
        if (p.skippedPast) continue;
        await db.appointmentReminder.upsert({
            where: { appointmentId_offsetMinutes_appointmentAt: { appointmentId: appointment.id, offsetMinutes: p.offsetMinutes, appointmentAt: appointment.dateTime } },
            create: { tenantId: appointment.tenantId, appointmentId: appointment.id, offsetMinutes: p.offsetMinutes, appointmentAt: appointment.dateTime, scheduledFor: p.scheduledFor },
            // An existing row is left exactly as it is here: a SENT reminder must never be sent twice.
            update: {},
        });
    }
    // Revive reminders that were CANCELLED for this very appointment time (it was reopened), with a
    // bumped generation so their queue job id is new. Past-due ones are not revived.
    await db.appointmentReminder.updateMany({
        where: { appointmentId: appointment.id, appointmentAt: appointment.dateTime, status: "CANCELLED", scheduledFor: { gt: now } },
        data: { status: "PENDING", generation: { increment: 1 }, lastError: null, claimToken: null, claimedAt: null, attempts: 0 },
    });
    // Only still-PENDING rows need a queue job.
    return db.appointmentReminder.findMany({ where: { appointmentId: appointment.id, appointmentAt: appointment.dateTime, status: "PENDING" } });
}
