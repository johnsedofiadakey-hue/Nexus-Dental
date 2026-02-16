// ============================================
// NEXUS DENTAL — Notification Engine
// WhatsApp → SMS → Email fallback chain
// ============================================

import prisma from "@/lib/db/prisma";
import type { NotificationChannel, NotificationStatus } from "@prisma/client";

export interface NotificationPayload {
    tenantId: string;
    recipientId: string;
    type: string;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
    preferredChannel?: NotificationChannel;
}

export interface SendResult {
    notificationId: string;
    channel: NotificationChannel;
    status: NotificationStatus;
    failReason?: string;
}

// Channel priority for fallback
const FALLBACK_CHAIN: NotificationChannel[] = [
    "WHATSAPP",
    "SMS",
    "EMAIL",
    "PUSH",
];

/**
 * Send a notification with automatic fallback.
 *
 * Tries channels in order: WhatsApp → SMS → Email → Push
 * If the preferred channel fails, falls back to the next.
 */
export async function sendNotification(
    payload: NotificationPayload
): Promise<SendResult> {
    const channels = payload.preferredChannel
        ? [
            payload.preferredChannel,
            ...FALLBACK_CHAIN.filter((c) => c !== payload.preferredChannel),
        ]
        : FALLBACK_CHAIN;

    let lastError: string | undefined;

    for (const channel of channels) {
        // Create the notification record
        const notification = await prisma.notification.create({
            data: {
                tenantId: payload.tenantId,
                recipientId: payload.recipientId,
                channel,
                type: payload.type,
                title: payload.title,
                content: payload.content,
                metadata: payload.metadata
                    ? JSON.parse(JSON.stringify(payload.metadata))
                    : undefined,
                status: "QUEUED",
            },
        });

        try {
            // Attempt delivery via the channel
            const success = await deliverViaChannel(channel, payload);

            if (success) {
                // Mark as sent
                await prisma.notification.update({
                    where: { id: notification.id },
                    data: {
                        status: "SENT",
                        sentAt: new Date(),
                    },
                });

                return {
                    notificationId: notification.id,
                    channel,
                    status: "SENT",
                };
            } else {
                lastError = `${channel} delivery returned false`;
                await prisma.notification.update({
                    where: { id: notification.id },
                    data: {
                        status: "FAILED",
                        failedAt: new Date(),
                        failReason: lastError,
                    },
                });
            }
        } catch (err) {
            lastError =
                err instanceof Error
                    ? err.message
                    : `${channel} delivery failed`;
            await prisma.notification.update({
                where: { id: notification.id },
                data: {
                    status: "FAILED",
                    failedAt: new Date(),
                    failReason: lastError,
                },
            });
        }
    }

    // All channels failed
    return {
        notificationId: "",
        channel: channels[channels.length - 1],
        status: "FAILED",
        failReason: `All channels exhausted. Last error: ${lastError}`,
    };
}

/**
 * Deliver notification via a specific channel.
 *
 * In production, these would integrate with:
 * - WhatsApp: Meta Business API / Twilio
 * - SMS: Twilio / Africa's Talking
 * - Email: Resend / SendGrid
 * - Push: Firebase Cloud Messaging
 *
 * Currently returns true to simulate successful delivery.
 */
async function deliverViaChannel(
    channel: NotificationChannel,
    payload: NotificationPayload
): Promise<boolean> {
    switch (channel) {
        case "WHATSAPP":
            // TODO: Integrate with WhatsApp Business API
            console.log(
                `[Notification] WhatsApp → ${payload.recipientId}: ${payload.title}`
            );
            return true;

        case "SMS":
            // TODO: Integrate with SMS provider (Twilio / Africa's Talking)
            console.log(
                `[Notification] SMS → ${payload.recipientId}: ${payload.title}`
            );
            return true;

        case "EMAIL":
            // TODO: Integrate with email provider (Resend / SendGrid)
            console.log(
                `[Notification] Email → ${payload.recipientId}: ${payload.title}`
            );
            return true;

        case "PUSH":
            // TODO: Integrate with FCM
            console.log(
                `[Notification] Push → ${payload.recipientId}: ${payload.title}`
            );
            return true;

        default:
            return false;
    }
}

/**
 * Send appointment confirmation notification.
 */
export async function notifyAppointmentConfirmed(
    tenantId: string,
    patientId: string,
    appointmentDetails: {
        doctorName: string;
        serviceName: string;
        dateTime: Date;
        duration: number;
    }
): Promise<SendResult> {
    const dateStr = appointmentDetails.dateTime.toLocaleDateString("en-GH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const timeStr = appointmentDetails.dateTime.toLocaleTimeString("en-GH", {
        hour: "2-digit",
        minute: "2-digit",
    });

    return sendNotification({
        tenantId,
        recipientId: patientId,
        type: "APPOINTMENT_CONFIRMED",
        title: "Appointment Confirmed",
        content: `Your ${appointmentDetails.serviceName} appointment with ${appointmentDetails.doctorName} is confirmed for ${dateStr} at ${timeStr} (${appointmentDetails.duration} min).`,
        metadata: appointmentDetails as unknown as Record<string, unknown>,
    });
}

/**
 * Send appointment reminder notification (24h before).
 */
export async function notifyAppointmentReminder(
    tenantId: string,
    patientId: string,
    appointmentDetails: {
        doctorName: string;
        serviceName: string;
        dateTime: Date;
    }
): Promise<SendResult> {
    const timeStr = appointmentDetails.dateTime.toLocaleTimeString("en-GH", {
        hour: "2-digit",
        minute: "2-digit",
    });

    return sendNotification({
        tenantId,
        recipientId: patientId,
        type: "APPOINTMENT_REMINDER",
        title: "Appointment Tomorrow",
        content: `Reminder: Your ${appointmentDetails.serviceName} appointment with ${appointmentDetails.doctorName} is tomorrow at ${timeStr}. Reply CANCEL to cancel.`,
    });
}

/**
 * Send support ticket update notification.
 */
export async function notifySupportUpdate(
    tenantId: string,
    patientId: string,
    ticketSubject: string,
    message: string
): Promise<SendResult> {
    return sendNotification({
        tenantId,
        recipientId: patientId,
        type: "SUPPORT_UPDATE",
        title: `Support Update: ${ticketSubject}`,
        content: message,
    });
}

/**
 * Get notification history for a recipient.
 */
export async function getNotificationHistory(
    tenantId: string,
    recipientId?: string,
    filters?: {
        type?: string;
        status?: NotificationStatus;
        channel?: NotificationChannel;
        page?: number;
        limit?: number;
    }
) {
    const where: Record<string, unknown> = { tenantId };
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    if (recipientId) where.recipientId = recipientId;
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.channel) where.channel = filters.channel;

    const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.notification.count({ where }),
    ]);

    return {
        notifications,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
