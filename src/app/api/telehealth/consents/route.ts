import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { getTenantIdFromUser } from "@/lib/clinic";
import prisma from "@/lib/db/prisma";
import type { JWTPayload, PatientJWTPayload } from "@/lib/auth";

/**
 * POST /api/telehealth/consents
 * Save pre-visit consent for a telehealth consultation
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const user = authResult.user as JWTPayload | PatientJWTPayload;
    const tenantId = getTenantIdFromUser(user);

    const body = await request.json();
    const {
      appointmentId,
      recordingConsent,
      dataUseConsent,
      termsAccepted,
    } = body;

    if (!appointmentId || typeof termsAccepted !== "boolean") {
      return apiError("appointmentId and termsAccepted are required", 400);
    }

    // Verify appointment exists
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        tenantId,
      },
    });

    if (!appointment) {
      return apiError("Appointment not found", 404);
    }

    // Only patient can give consent for themselves
    if (user.type === "PATIENT") {
      const patientUser = user as PatientJWTPayload;
      if (patientUser.patientId !== appointment.patientId) {
        return apiError("You can only consent for your own appointment", 403);
      }
    }

    // Create consent record (using existing ConsentTemplate system)
    // First, get or create telehealth consent template
    const template = await prisma.consentTemplate.findFirst({
      where: {
        category: "telehealth",
        tenantId: null, // System template
      },
    });

    if (!template) {
      return apiError(
        "Telehealth consent template not found. Please contact support.",
        404
      );
    }

    // Save patient consent
    const consent = await prisma.patientConsent.create({
      data: {
        tenantId,
        patientId: appointment.patientId,
        appointmentId,
        templateId: template.id,
        signatureData: JSON.stringify({
          recordingConsent,
          dataUseConsent,
          termsAccepted,
          consentedAt: new Date().toISOString(),
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        }),
      },
    });

    return apiSuccess(
      {
        consentId: consent.id,
        appointmentId: consent.appointmentId,
        consented: true,
        timestamp: consent.signedAt,
      },
      201
    );
  } catch (error: any) {
    console.error("[Telehealth Consent API] Error:", error);
    return apiError("Failed to save consent", 500);
  }
}

/**
 * GET /api/telehealth/consents
 * Get consent status for an appointment
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const user = authResult.user as JWTPayload | PatientJWTPayload;
    const tenantId = getTenantIdFromUser(user);

    const { searchParams } = new URL(request.url);
    const appointmentId = searchParams.get("appointmentId");

    if (!appointmentId) {
      return apiError("appointmentId is required", 400);
    }

    // Verify appointment exists
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        tenantId,
      },
    });

    if (!appointment) {
      return apiError("Appointment not found", 404);
    }

    // Get consent for this appointment
    const consent = await prisma.patientConsent.findFirst({
      where: {
        appointmentId,
        tenantId,
      },
      include: {
        template: {
          select: {
            category: true,
            title: true,
          },
        },
      },
    });

    return apiSuccess({
      consentStatus: consent ? "GIVEN" : "PENDING",
      consent: consent
        ? {
            id: consent.id,
            templateCategory: consent.template.category,
            templateTitle: consent.template.title,
            signedAt: consent.signedAt,
          }
        : null,
    });
  } catch (error: any) {
    console.error("[Telehealth Consent API] GET Error:", error);
    return apiError("Failed to fetch consent status", 500);
  }
}
