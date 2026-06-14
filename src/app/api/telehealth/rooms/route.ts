import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { getTenantIdFromUser } from "@/lib/clinic";
import { TelehealthService } from "@/lib/services/telehealth.service";
import prisma from "@/lib/db/prisma";
import type { JWTPayload } from "@/lib/auth";

/**
 * POST /api/telehealth/rooms
 * Create a new video consultation room for an appointment
 * Requires: appointmentId
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const user = authResult.user as JWTPayload;
    const tenantId = getTenantIdFromUser(user);

    const body = await request.json();
    const { appointmentId } = body;

    if (!appointmentId) {
      return apiError("appointmentId is required", 400);
    }

    // Verify appointment exists and belongs to this tenant
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        tenantId,
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { firstName: true, lastName: true } },
      },
    });

    if (!appointment) {
      return apiError("Appointment not found", 404);
    }

    // Only allow doctor or staff to create rooms
    const isDoctor = user.userId === appointment.doctorId;
    const isStaff = ["CLINIC_OWNER", "ADMIN", "RECEPTIONIST"].includes(
      user.roles?.[0] as string
    );

    if (!isDoctor && !isStaff) {
      return apiError("Only clinical staff can create consultation rooms", 403);
    }

    // Create Daily.co room
    const room = await TelehealthService.createConsultationRoom({
      appointmentId,
      patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
      doctorName: `${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
      durationMinutes: 60,
    });

    // Update appointment with video session ID
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { videoSessionId: room.name },
    });

    return apiSuccess(
      {
        roomName: room.name,
        roomUrl: room.url,
        roomId: room.id,
        privacyLevel: room.privacy,
        maxParticipants: room.max_participants,
        createdAt: room.created_at,
      },
      201
    );
  } catch (error: any) {
    console.error("[Telehealth API] POST Error:", error);
    return apiError(error.message || "Failed to create consultation room", 500);
  }
}

/**
 * GET /api/telehealth/rooms
 * List active consultation rooms for the clinic
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const user = authResult.user as JWTPayload;
    const tenantId = getTenantIdFromUser(user);

    // Get all active appointments with video sessions for this tenant
    const activeAppointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        videoSessionId: { not: null },
        status: { in: ["SCHEDULED", "CHECKED_IN", "IN_CHAIR"] },
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { firstName: true, lastName: true, avatar: true } },
      },
      orderBy: { dateTime: "asc" },
    });

    return apiSuccess({
      activeConsultations: activeAppointments.map((apt: any) => ({
        appointmentId: apt.id,
        roomName: apt.videoSessionId,
        patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
        doctorName: `${apt.doctor.firstName} ${apt.doctor.lastName}`,
        doctorAvatar: apt.doctor.avatar,
        status: apt.status,
        scheduledTime: apt.dateTime,
      })),
    });
  } catch (error: any) {
    console.error("[Telehealth API] GET Error:", error);
    return apiError("Failed to fetch consultation rooms", 500);
  }
}
