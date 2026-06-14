import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { getTenantIdFromUser } from "@/lib/clinic";
import { TelehealthService } from "@/lib/services/telehealth.service";
import prisma from "@/lib/db/prisma";
import type { JWTPayload } from "@/lib/auth";

/**
 * GET /api/telehealth/rooms/[id]
 * Get room details and access token for joining a consultation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const user = authResult.user as any; // Can be JWTPayload or PatientJWTPayload
    const tenantId = getTenantIdFromUser(user);

    const { id: appointmentId } = await params;

    // Verify appointment exists
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        tenantId,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!appointment || !appointment.videoSessionId) {
      return apiError("Consultation room not found", 404);
    }

    // Verify user has access (either patient or doctor)
    const isPatient = user.type === "PATIENT" && user.patientId === appointment.patientId;
    const isDoctor = user.userId === appointment.doctorId;
    const isStaff = ["CLINIC_OWNER", "ADMIN", "RECEPTIONIST"].includes(
      user.roles?.[0] as string
    );

    if (!isPatient && !isDoctor && !isStaff) {
      return apiError("You do not have access to this consultation", 403);
    }

    // Get room details from Daily.co
    let roomDetails;
    try {
      roomDetails = await TelehealthService.getRoomInfo(appointment.videoSessionId);
    } catch (error: any) {
      console.error("[Telehealth] Failed to get room info:", error);
      // Room might have expired, return what we know
      roomDetails = null;
    }

    // Generate session token info
    const userName = isPatient
      ? `${appointment.patient.firstName} ${appointment.patient.lastName}`
      : `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`;

    return apiSuccess({
      appointment: {
        id: appointment.id,
        patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        doctorName: `${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
        scheduledTime: appointment.dateTime,
        status: appointment.status,
      },
      consultation: {
        roomName: appointment.videoSessionId,
        roomUrl: roomDetails?.url || null,
        userName,
        userId: isPatient ? appointment.patientId : user.userId,
        isDoctor: isDoctor || isStaff,
        joinUrl: roomDetails
          ? `${roomDetails.url}?name=${encodeURIComponent(userName)}`
          : null,
      },
    });
  } catch (error: any) {
    console.error("[Telehealth API] GET [id] Error:", error);
    return apiError("Failed to fetch consultation details", 500);
  }
}

/**
 * POST /api/telehealth/rooms/[id]/end
 * End a consultation session and optionally record transcription
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const user = authResult.user as any; // Can be JWTPayload or PatientJWTPayload
    const tenantId = getTenantIdFromUser(user);

    const { id: appointmentId } = await params;
    const body = await request.json();
    const { saveTranscription = false } = body;

    // Verify appointment and access
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        tenantId,
      },
    });

    if (!appointment || !appointment.videoSessionId) {
      return apiError("Consultation not found", 404);
    }

    // Only doctor can end consultation
    if (user.userId !== appointment.doctorId) {
      return apiError("Only the doctor can end a consultation", 403);
    }

    // Get transcription if requested
    let transcription = null;
    if (saveTranscription) {
      try {
        transcription = await TelehealthService.getTranscription(appointment.videoSessionId);
      } catch (error) {
        console.warn("[Telehealth] Transcription not available");
      }
    }

    // Stop recording if active
    try {
      await TelehealthService.stopRecording(appointment.videoSessionId);
    } catch (error) {
      console.warn("[Telehealth] Stop recording error (may not be supported)");
    }

    // Delete room to close session
    try {
      await TelehealthService.deleteRoom(appointment.videoSessionId);
    } catch (error: any) {
      console.warn("[Telehealth] Room already closed:", error.message);
    }

    // Update appointment status and clear video session
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        videoSessionId: null,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    return apiSuccess({
      message: "Consultation ended successfully",
      transcription: transcription || null,
      status: "COMPLETED",
    });
  } catch (error: any) {
    console.error("[Telehealth API] POST [id] Error:", error);
    return apiError("Failed to end consultation", 500);
  }
}
