// ============================================
// NEXUS DENTAL — Appointment Worker
// Background reminders and lifecycle management
// ============================================

import { Worker, Job } from "bullmq";
import { queueRedisConnection } from "../redis";
import prisma from "@/lib/db/prisma";
import { notificationQueue } from "../queues";

interface AppointmentJobData {
    type: "REMINDER_24H" | "REMINDER_1H" | "NO_SHOW_CHECK";
    appointmentId: string;
    tenantId: string;
}

/**
 * Appointment Worker:
 * Prcesses reminders and audits appointment states
 */
export const appointmentWorker = new Worker(
    "appointment-queue",
    async (job: Job<AppointmentJobData>) => {
        const { type, appointmentId, tenantId } = job.data;

        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: {
                patient: true,
                doctor: true,
                service: true,
            },
        });

        if (!appointment) {
            console.warn(`[Worker] Appointment ${appointmentId} not found, skipping job`);
            return;
        }

        // If appointment was cancelled or is already checked in, skip reminders
        if (
            type !== "NO_SHOW_CHECK" &&
            (appointment.status === "CANCELLED" || appointment.status !== "SCHEDULED")
        ) {
            console.log(`[Worker] Appointment ${appointmentId} status is ${appointment.status}, skipping reminder`);
            return;
        }

        switch (type) {
            case "REMINDER_24H":
                await enqueueReminder(appointment, "Upcoming Appointment Tomorrow");
                break;
            case "REMINDER_1H":
                await enqueueReminder(appointment, "Appointment Starting Soon");
                break;
            case "NO_SHOW_CHECK":
                await handleNoShow(appointment);
                break;
        }
    },
    {
        connection: queueRedisConnection as any,
        concurrency: 10,
    }
);

async function enqueueReminder(appointment: any, title: string) {
    const timeStr = appointment.dateTime.toLocaleTimeString("en-GH", {
        hour: "2-digit",
        minute: "2-digit",
    });

    await notificationQueue.add(`reminder-${appointment.id}`, {
        tenantId: appointment.tenantId,
        recipientId: appointment.patientId,
        type: "APPOINTMENT_REMINDER",
        title,
        content: `Reminder: Your ${appointment.service.name} appointment with Dr. ${appointment.doctor.lastName} is at ${timeStr}.`,
        metadata: { appointmentId: appointment.id },
    });
}

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
