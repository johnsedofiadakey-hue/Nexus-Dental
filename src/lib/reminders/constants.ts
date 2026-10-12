// ============================================
// NEXUS DENTAL — Appointment reminder constants
// Dependency-free so the booking route, the worker and tests share ONE definition.
// ============================================

/** Minutes before the appointment at which an SMS reminder is due. */
export const REMINDER_OFFSETS = [60, 30] as const;
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

/** A claimed reminder can be taken over by another worker only after this long (a send takes seconds). */
export const REMINDER_CLAIM_LEASE_MS = 10 * 60_000;

/** A reminder is useless once the appointment has started. */
export const REMINDER_GRACE_AFTER_DUE_MS = 15 * 60_000;

export const APPOINTMENT_QUEUE_JOB = "sms-reminder";

/** Stable BullMQ job id: unique per reminder AND generation. Colons are not allowed in BullMQ custom ids. */
export function reminderJobId(reminderId: string, generation: number): string {
    return `reminder-${reminderId}-g${generation}`;
}

export interface ReminderJobData {
    type: "REMINDER";
    reminderId: string;
    appointmentId: string;
    tenantId: string;
}

/** Statuses after which a reminder must never be sent, whatever the queue says. */
export const NO_REMINDER_APPOINTMENT_STATUSES = ["CANCELLED", "CHECKED_IN", "IN_IMAGING", "IN_CHAIR", "COMPLETED", "CHECKOUT", "NO_SHOW"] as const;
