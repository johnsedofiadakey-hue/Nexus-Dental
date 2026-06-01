// ============================================
// NEXUS DENTAL — Recall Worker
// Background patient follow-up checks
// ============================================

import { Worker, Job } from "bullmq";
import { queueRedisConnection } from "../redis";
import prisma from "@/lib/db/prisma";
import { notificationQueue } from "../queues";
import {
    sendNotification as hubtelSend,
    recallMessage,
} from "@/lib/sms/hubtel";

interface RecallJobData {
    tenantId: string;
    recallType: "ROUTINE_CHECKUP" | "POST_OP_FOLLOWUP";
}

/**
 * Recall Worker:
 * Processes automated patient recalls based on clinical history
 */
const isBuild = process.env.NODE_ENV === "production" && !process.env.REDIS_URL;

export const recallWorker = isBuild ? ({} as Worker) : new Worker(
    "recall-queue",
    async (job: Job<RecallJobData>) => {
        const { tenantId, recallType } = job.data;

        if (recallType === "ROUTINE_CHECKUP") {
            await processRoutineCheckups(tenantId);
        }
    },
    {
        connection: queueRedisConnection as any,
        concurrency: 1, // Recalls are heavy, process slowly
    }
);

async function processRoutineCheckups(tenantId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Patients who haven't had an appointment in 6 months
    const patientsToRecall = await prisma.patient.findMany({
        where: {
            tenantId,
            appointments: {
                none: {
                    dateTime: { gte: sixMonthsAgo },
                },
            },
            // Ensure they've had at least one appointment ever to be considered "active"
            NOT: {
                appointments: { none: {} }
            }
        },
        include: {
            appointments: {
                orderBy: { dateTime: "desc" },
                take: 1,
            },
        },
    });

    const clinic = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, phone: true },
    });

    for (const patient of patientsToRecall) {
        const message = recallMessage(
            `${patient.firstName} ${patient.lastName}`,
            clinic?.name ?? "our clinic",
            clinic?.phone ?? ""
        );

        // Send recall via SMS (OTP-style, single channel)
        if (patient.phone) {
            await hubtelSend(patient.phone, message, "sms");
        }

        // Also queue in-app notification via BullMQ
        await notificationQueue.add(`recall-${patient.id}`, {
            tenantId,
            recipientId: patient.id,
            type: "PATIENT_RECALL",
            title: "Time for your Routine Checkup",
            content: message,
            metadata: { recallType: "ROUTINE_CHECKUP" },
        });
    }

    console.log(`[Worker] Processed routine checkups for ${patientsToRecall.length} patients in tenant ${tenantId}`);
}
