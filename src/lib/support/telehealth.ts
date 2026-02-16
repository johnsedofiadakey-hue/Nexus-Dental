// ============================================
// NEXUS DENTAL — Telehealth Session Manager
// Virtual consultation management
// ============================================

import prisma from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit/logger";
import { sendNotification } from "./notifications";

export interface TelehealthSession {
    appointmentId: string;
    tenantId: string;
    doctorId: string;
    patientId: string;
    roomUrl: string;
    joinToken: string;
    startsAt: Date;
    expiresAt: Date;
    status: "WAITING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
}

export interface ConsultationSummary {
    appointmentId: string;
    doctorName: string;
    patientName: string;
    date: string;
    duration: number;
    chiefComplaint: string;
    findings: string;
    recommendations: string;
    followUpDate?: string;
    prescriptions?: Array<{
        name: string;
        dosage: string;
        frequency: string;
        duration: string;
    }>;
}

/**
 * Create a telehealth session for a VIRTUAL appointment.
 *
 * Generates a room URL and join tokens for doctor and patient.
 * In production, integrates with a video provider (Daily.co, Twilio Video, etc.)
 */
export async function createTelehealthSession(
    tenantId: string,
    appointmentId: string,
    doctorId: string
): Promise<TelehealthSession> {
    // Verify the appointment
    const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
            patient: { select: { id: true, firstName: true, lastName: true } },
            doctor: { select: { id: true, firstName: true, lastName: true } },
            service: { select: { name: true, duration: true } },
        },
    });

    if (!appointment) throw new Error("Appointment not found");
    if (appointment.tenantId !== tenantId) throw new Error("Tenant mismatch");
    if (appointment.type !== "VIRTUAL")
        throw new Error("Appointment is not a virtual consultation");
    if (appointment.doctorId !== doctorId)
        throw new Error("Only the assigned doctor can start the session");

    // Generate room credentials
    // In production: call Daily.co / Twilio Video API
    const roomId = `nexus-${tenantId.slice(0, 8)}-${appointmentId.slice(0, 8)}`;
    const roomUrl = `https://meet.nexusdental.com/${roomId}`;
    const joinToken = generateSessionToken();

    const sessionDuration = appointment.service.duration || 30;
    const startsAt = new Date();
    const expiresAt = new Date(
        startsAt.getTime() + sessionDuration * 60 * 1000 + 15 * 60 * 1000 // +15min buffer
    );

    // Update appointment status to IN_CHAIR (active session)
    await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
            status: "IN_CHAIR",
            notes: JSON.stringify({
                telehealthRoomUrl: roomUrl,
                telehealthStartedAt: startsAt.toISOString(),
            }),
        },
    });

    // Record transition
    await prisma.appointmentTransition.create({
        data: {
            appointmentId,
            fromStatus: appointment.status,
            toStatus: "IN_CHAIR",
            triggeredBy: doctorId,
            reason: "Telehealth session started",
        },
    });

    // Notify patient
    await sendNotification({
        tenantId,
        recipientId: appointment.patientId,
        type: "TELEHEALTH_SESSION_READY",
        title: "Your Virtual Consultation is Ready",
        content: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} is ready for your virtual consultation. Join here: ${roomUrl}`,
        metadata: {
            roomUrl,
            appointmentId,
            expiresAt: expiresAt.toISOString(),
        },
    });

    // Audit
    await logAudit({
        tenantId,
        userId: doctorId,
        action: "TELEHEALTH_SESSION_STARTED",
        entity: "Appointment",
        entityId: appointmentId,
        newValue: { roomUrl, expiresAt: expiresAt.toISOString() },
    });

    return {
        appointmentId,
        tenantId,
        doctorId,
        patientId: appointment.patientId,
        roomUrl,
        joinToken,
        startsAt,
        expiresAt,
        status: "WAITING",
    };
}

/**
 * Generate a PDF-ready consultation summary.
 *
 * Returns structured data that can be rendered to PDF
 * by the frontend using jsPDF or similar.
 */
export async function generateConsultationSummary(
    tenantId: string,
    appointmentId: string,
    doctorId: string,
    summaryData: {
        chiefComplaint: string;
        findings: string;
        recommendations: string;
        followUpDate?: string;
    }
): Promise<ConsultationSummary> {
    const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
            patient: { select: { firstName: true, lastName: true } },
            doctor: { select: { firstName: true, lastName: true } },
            service: { select: { duration: true } },
        },
    });

    if (!appointment) throw new Error("Appointment not found");
    if (appointment.tenantId !== tenantId) throw new Error("Tenant mismatch");
    if (appointment.doctorId !== doctorId)
        throw new Error("Only the assigned doctor can generate summaries");

    // Get prescriptions if any
    const prescriptions = await prisma.prescription.findMany({
        where: { appointmentId },
    });

    const prescriptionList =
        prescriptions.length > 0
            ? (prescriptions[0].medications as Array<{
                name: string;
                dosage: string;
                frequency: string;
                duration: string;
            }>)
            : undefined;

    const summary: ConsultationSummary = {
        appointmentId,
        doctorName: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
        patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        date: appointment.dateTime.toLocaleDateString("en-GH", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        }),
        duration: appointment.service.duration || 30,
        chiefComplaint: summaryData.chiefComplaint,
        findings: summaryData.findings,
        recommendations: summaryData.recommendations,
        followUpDate: summaryData.followUpDate,
        prescriptions: prescriptionList,
    };

    // Audit
    await logAudit({
        tenantId,
        userId: doctorId,
        action: "CONSULTATION_SUMMARY_GENERATED",
        entity: "Appointment",
        entityId: appointmentId,
        newValue: { hasFollowUp: !!summaryData.followUpDate },
    });

    return summary;
}

/**
 * Generate a secure session token.
 */
function generateSessionToken(): string {
    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 64; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
