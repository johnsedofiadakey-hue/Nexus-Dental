// ============================================
// NEXUS DENTAL — Insurance Reminder Worker
// Flags stale claims and reminds clinic staff to follow up with the insurer
// (Ghana insurers have no claims API — reminders are staff-mediated, not sent
// directly to the insurer)
// ============================================

import { Worker, Job } from "bullmq";
import { queueRedisConnection } from "../redis";
import prisma from "@/lib/db/prisma";
import { notificationQueue } from "../queues";
import { sendNotification as hubtelSend } from "@/lib/sms/hubtel";

interface InsuranceReminderJobData {
    tenantId: string;
}

const STALE_AFTER_DAYS = 5;
const REMINDER_TYPE = "INSURANCE_CLAIM_REMINDER";

const isBuild = process.env.NODE_ENV === "production" && !process.env.REDIS_URL;

export const insuranceReminderWorker = isBuild ? ({} as Worker) : new Worker(
    "insurance-queue",
    async (job: Job<InsuranceReminderJobData>) => {
        const { tenantId } = job.data;
        await processStaleClaims(tenantId);
    },
    {
        connection: queueRedisConnection as any,
        concurrency: 1,
    }
);

async function processStaleClaims(tenantId: string) {
    const staleThreshold = new Date();
    staleThreshold.setDate(staleThreshold.getDate() - STALE_AFTER_DAYS);

    const staleClaims = await prisma.insuranceClaim.findMany({
        where: {
            tenantId,
            status: { in: ["SUBMITTED", "PENDING"] },
            resolvedAt: null,
            submittedAt: { lte: staleThreshold },
        },
        include: {
            invoice: {
                include: { patient: { select: { firstName: true, lastName: true } } },
            },
        },
    });

    if (staleClaims.length === 0) return;

    // Avoid re-reminding about the same claim more than once a day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentReminders = await prisma.notification.findMany({
        where: { tenantId, type: REMINDER_TYPE, createdAt: { gte: oneDayAgo } },
        select: { metadata: true },
    });
    const alreadyReminded = new Set(
        recentReminders.map((n: any) => n.metadata?.claimId).filter(Boolean)
    );

    const claimsToRemind = staleClaims.filter((c: any) => !alreadyReminded.has(c.id));
    if (claimsToRemind.length === 0) return;

    const staff = await prisma.user.findMany({
        where: {
            tenantId,
            status: "ACTIVE",
            roles: { some: { systemRole: { in: ["BILLING_STAFF", "ADMIN", "CLINIC_OWNER"] } } },
        },
        select: { id: true, phone: true },
    });

    for (const claim of claimsToRemind) {
        const patientName = claim.invoice?.patient
            ? `${claim.invoice.patient.firstName} ${claim.invoice.patient.lastName}`
            : "a patient";
        const daysPending = Math.floor(
            (Date.now() - claim.submittedAt.getTime()) / (24 * 60 * 60 * 1000)
        );
        const message =
            `Insurance claim follow-up: ${claim.provider} claim for ${patientName} ` +
            `(GHS ${claim.claimedAmount.toFixed(2)}) has been pending ${daysPending} days. ` +
            `Please follow up with the insurer.`;

        for (const recipient of staff) {
            if (recipient.phone) {
                await hubtelSend(recipient.phone, message, "sms").catch(() => {});
            }
            await notificationQueue
                .add(`insurance-reminder-${claim.id}-${recipient.id}`, {
                    tenantId,
                    recipientId: recipient.id,
                    type: REMINDER_TYPE,
                    title: "Insurance claim needs follow-up",
                    content: message,
                    metadata: { claimId: claim.id, provider: claim.provider, daysPending },
                })
                .catch(() => {});
        }
    }

    console.log(
        `[Worker] Sent insurance reminders for ${claimsToRemind.length} stale claim(s) in tenant ${tenantId}`
    );
}
