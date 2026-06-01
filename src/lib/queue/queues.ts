// ============================================
// NEXUS DENTAL — BullMQ Queues
// Definition of all background queues
// ============================================

import { Queue } from "bullmq";
import { queueRedisConnection } from "./redis";

// Default job options
const defaultJobOptions = {
    removeOnComplete: {
        age: 3600, // keep for 1 hour
        count: 1000,
    },
    removeOnFail: {
        age: 24 * 3600, // keep for 24 hours
    },
    attempts: 3,
    backoff: {
        type: "exponential",
        delay: 5000, // 5s, 10s, 20s...
    },
};

const isBuild = process.env.NODE_ENV === "production" && !process.env.REDIS_URL;

/**
 * notification-queue:
 * Handles all outbound communication fallback chain
 */
export const notificationQueue = isBuild ? ({} as Queue) : new Queue("notification-queue", {
    connection: queueRedisConnection as any,
    defaultJobOptions,
});

/**
 * appointment-queue:
 * Handles reminders and lifecycle events
 */
export const appointmentQueue = isBuild ? ({} as Queue) : new Queue("appointment-queue", {
    connection: queueRedisConnection as any,
    defaultJobOptions,
});

/**
 * recall-queue:
 * Handles periodic patient follow-up checks
 */
export const recallQueue = isBuild ? ({} as Queue) : new Queue("recall-queue", {
    connection: queueRedisConnection as any,
    defaultJobOptions,
});

export type QueueName = "notification-queue" | "appointment-queue" | "recall-queue";

export function getQueue(name: QueueName): Queue {
    switch (name) {
        case "notification-queue":
            return notificationQueue;
        case "appointment-queue":
            return appointmentQueue;
        case "recall-queue":
            return recallQueue;
        default:
            throw new Error(`Queue ${name} not found`);
    }
}
