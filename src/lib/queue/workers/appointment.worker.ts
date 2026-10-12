// ============================================
// NEXUS DENTAL — Appointment Worker
// SMS appointment reminders and no-show detection
// ============================================

import { isBuildPhase } from "@/lib/config/build-phase";
import { Worker, Job, UnrecoverableError } from "bullmq";
import { queueRedisConnection } from "../redis";
import prisma from "@/lib/db/prisma";
import { APPOINTMENT_QUEUE_JOB, type ReminderJobData } from "@/lib/reminders/constants";
import { ReminderDeliveryError, dispatchReminder } from "@/lib/reminders/dispatch";

interface NoShowJobData {
    type: "NO_SHOW_CHECK";
    appointmentId: string;
    tenantId: string;
}

/** Jobs queued by the pre-C-demo code (24h/1h, sent via WhatsApp + a second notification). They must NOT send. */
interface ObsoleteReminderJobData {
    type: "REMINDER_24H" | "REMINDER_1H";
    appointmentId: string;
    tenantId: string;
}

type AppointmentJobData = ReminderJobData | NoShowJobData | ObsoleteReminderJobData;

/**
 * Appointment Worker.
 *
 * REMINDER jobs go through dispatchReminder(): one reminder, one claim, one SMS, one
 * persisted result (src/lib/reminders/dispatch.ts). Nothing here sends directly and then
 * enqueues a second sender: that double-send path no longer exists.
 */
const isBuild = isBuildPhase();

export const appointmentWorker = isBuild ? ({} as Worker) : new Worker(
    "appointment-queue",
    async (job: Job<AppointmentJobData>) => {
        const data = job.data;

        if (data.type === "REMINDER") {
            try {
                return await dispatchReminder(data.reminderId, { db: prisma });
            } catch (error) {
                // A recorded, non-retryable failure (not configured, demo-blocked, bad number) must not be
                // retried; a transient one (timeout, 5xx) keeps the queue's retry policy.
                if (error instanceof ReminderDeliveryError && !error.retryable) throw new UnrecoverableError(error.message);
                throw error;
            }
        }

        if (data.type === "REMINDER_24H" || data.type === "REMINDER_1H") {
            console.log(`[Worker] Ignoring obsolete ${data.type} job ${job.id}; reminders are now 60/30-minute SMS rows.`);
            return { skipped: "OBSOLETE" };
        }

        if (data.type === "NO_SHOW_CHECK") {
            const appointment = await prisma.appointment.findUnique({ where: { id: data.appointmentId } });
            if (!appointment) return;
            await handleNoShow(appointment);
            return;
        }

        console.warn(`[Worker] Unknown appointment job type on job ${job.id}`);
    },
    {
        connection: queueRedisConnection as any,
        concurrency: 10,
    }
);

export { APPOINTMENT_QUEUE_JOB };

async function handleNoShow(appointment: any) {
    // If appointment is still just "SCHEDULED" 30 mins after start time, mark as NO_SHOW
    if (appointment.status === "SCHEDULED") {
        await prisma.appointment.update({
            where: { id: appointment.id },
            data: { status: "NO_SHOW" },
        });

        await prisma.appointmentTransition.create({
            data: {
                appointmentId: appointment.id,
                fromStatus: "SCHEDULED",
                toStatus: "NO_SHOW",
                triggeredBy: "SYSTEM_WORKER",
                reason: "Automated no-show detection",
            },
        });

        console.log(`[Worker] Appointment ${appointment.id} marked as NO_SHOW`);
    }
}
