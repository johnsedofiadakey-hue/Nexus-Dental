// ============================================
// NEXUS DENTAL — Emergency Video Call API
// POST /api/telehealth/emergency
// Patient-initiated, on-demand video consultation (no pre-booked appointment)
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, isPatientUser, apiError, apiSuccess } from "@/lib/auth";
import type { PatientJWTPayload } from "@/lib/auth";
import { TelehealthService } from "@/lib/services/telehealth.service";
import { sendNotification as hubtelSend } from "@/lib/sms/hubtel";
import { notificationQueue } from "@/lib/queue/queues";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";

const EMERGENCY_SERVICE_NAME = "Emergency Video Consultation";
const EMERGENCY_DURATION_MINUTES = 30;

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const user = authResult.user;

        // Video needs the Daily provider. Until DAILY_API_KEY is configured, fail
        // cleanly instead of surfacing a raw server error to patients and staff.
        if (!process.env.DAILY_API_KEY) {
            return apiError("Video consultations are not available yet. Please call the clinic directly.", 503);
        }

        if (!isPatientUser(user)) {
            return apiError("Only patients can start an emergency video call", 403);
        }
        const { patientId, tenantId } = user as PatientJWTPayload;

        const patient = await prisma.patient.findFirst({
            where: { id: patientId, tenantId },
            select: { firstName: true, lastName: true },
        });
        if (!patient) return apiError("Patient not found", 404);

        // Find (or create) the standing "Emergency Video Consultation" service for this tenant
        let emergencyService = await prisma.service.findFirst({
            where: { tenantId, name: EMERGENCY_SERVICE_NAME },
        });
        if (!emergencyService) {
            emergencyService = await prisma.service.create({
                data: {
                    tenantId,
                    name: EMERGENCY_SERVICE_NAME,
                    description: "On-demand emergency video consultation, triggered by patient",
                    category: "EMERGENCY",
                    duration: EMERGENCY_DURATION_MINUTES,
                    price: 0,
                    isActive: true,
                },
            });
        }

        // Find the most recently active on-call doctor for this tenant
        const doctor = await prisma.user.findFirst({
            where: {
                tenantId,
                status: "ACTIVE",
                roles: { some: { systemRole: "DOCTOR" } },
            },
            orderBy: { lastLoginAt: "desc" },
        });
        if (!doctor) {
            return apiError(
                "No doctor is currently available for an emergency video call. Please call the clinic directly.",
                503
            );
        }

        const now = new Date();
        const endTime = new Date(now.getTime() + EMERGENCY_DURATION_MINUTES * 60 * 1000);

        const appointment = await prisma.appointment.create({
            data: {
                tenantId,
                patientId,
                doctorId: doctor.id,
                serviceId: emergencyService.id,
                type: "VIRTUAL",
                status: "SCHEDULED",
                dateTime: now,
                endTime,
                notes: "Emergency video consultation requested by patient",
                transitions: {
                    create: {
                        fromStatus: "SCHEDULED",
                        toStatus: "SCHEDULED",
                        triggeredBy: "PATIENT_SELF",
                        reason: "Emergency video call requested",
                    },
                },
            },
        });

        const room = await TelehealthService.createConsultationRoom({
            appointmentId: appointment.id,
            patientName: `${patient.firstName} ${patient.lastName}`,
            doctorName: `${doctor.firstName} ${doctor.lastName}`,
            durationMinutes: EMERGENCY_DURATION_MINUTES,
        });

        await prisma.appointment.update({
            where: { id: appointment.id },
            data: { videoSessionId: room.name },
        });

        // Page the on-call doctor + front-desk roles immediately
        const alertRecipients = await prisma.user.findMany({
            where: {
                tenantId,
                status: "ACTIVE",
                roles: { some: { systemRole: { in: ["DOCTOR", "RECEPTIONIST", "CLINIC_OWNER"] } } },
            },
            select: { id: true, phone: true },
        });

        const alertMessage = `EMERGENCY: ${patient.firstName} ${patient.lastName} has started an emergency video consultation. Join now: ${room.url}`;

        await Promise.all(
            alertRecipients.map(async (recipient: any) => {
                if (recipient.phone) {
                    await hubtelSend(recipient.phone, alertMessage, "sms").catch(() => {});
                }
                await notificationQueue
                    .add(`emergency-call-${appointment.id}-${recipient.id}`, {
                        tenantId,
                        recipientId: recipient.id,
                        type: "EMERGENCY_VIDEO_CALL",
                        title: "Emergency video call started",
                        content: alertMessage,
                        metadata: { appointmentId: appointment.id, roomUrl: room.url },
                    })
                    .catch(() => {});
            })
        );

        await logAudit({
            tenantId,
            userId: null,
            action: "EMERGENCY_VIDEO_CALL_STARTED",
            entity: "Appointment",
            entityId: appointment.id,
            newValue: { doctorId: doctor.id, roomName: room.name },
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        return apiSuccess(
            {
                appointmentId: appointment.id,
                roomUrl: room.url,
                roomName: room.name,
                doctorName: `${doctor.firstName} ${doctor.lastName}`,
                expiresAt: endTime,
            },
            201
        );
    } catch (error: any) {
        console.error("[Emergency Telehealth] Error:", error);
        return apiError(error.message || "Failed to start emergency video call", 500);
    }
}
