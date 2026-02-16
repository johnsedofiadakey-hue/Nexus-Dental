// ============================================
// NEXUS DENTAL — Notification Worker
// Background processing for messages + fallbacks
// ============================================

import { Worker, Job } from "bullmq";
import { queueRedisConnection } from "../redis";
import prisma from "@/lib/db/prisma";
import { sendNotification } from "@/lib/support/notifications";
import type { NotificationPayload } from "@/lib/support/notifications";

/**
 * Notification Worker:
 * Processes messages from the notification-queue.
 * Leverages the existing notification engine fallback logic.
 */
export const notificationWorker = new Worker(
    "notification-queue",
    async (job: Job<NotificationPayload>) => {
        const { tenantId, recipientId, type, title, content, preferredChannel, metadata } = job.data;

        console.log(`[Worker] Processing notification job ${job.id} for recipient ${recipientId}`);

        try {
            // Use the established notification service which handles the fallback chain
            const result = await sendNotification({
                tenantId,
                recipientId,
                type,
                title,
                content,
                preferredChannel,
                metadata: {
                    ...metadata,
                    jobId: job.id,
                },
            });

            if (result.status === "FAILED") {
                throw new Error(result.failReason || "All channels failed");
            }

            return result;
        } catch (error) {
            console.error(`[Worker] Notification job ${job.id} failed:`, error);
            throw error; // Let BullMQ handle retry based on attempt settings
        }
    },
    {
        connection: queueRedisConnection as any,
        concurrency: 5,
    }
);

notificationWorker.on("completed", (job) => {
    console.log(`[Worker] Notification job ${job.id} completed successfully`);
});

notificationWorker.on("failed", (job, err) => {
    console.error(`[Worker] Notification job ${job?.id} failed:`, err);
});
