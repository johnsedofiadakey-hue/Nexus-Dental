// ============================================
// NEXUS DENTAL — Sign a Consent Form
// POST /api/consent/sign
// Body: { templateId, patientId, tenantId, appointmentId?, signatureData, ipAddress? }
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
  requireAuth,
  apiError,
  apiSuccess,
} from "@/lib/auth";
import { getClinicId } from "@/lib/clinic";

export async function POST(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;

    const body = await request.json() as {
      templateId?: string;
      patientId?: string;
      tenantId?: string;
      appointmentId?: string;
      signatureData?: string;
      ipAddress?: string;
    };

    const tenantId = getClinicId();
    const { templateId, patientId, appointmentId, signatureData, ipAddress } = body;

    if (!templateId) return apiError("templateId is required", 400);
    if (!patientId) return apiError("patientId is required", 400);
    if (!signatureData) return apiError("signatureData is required", 400);

    // Verify template exists and is accessible by this tenant
    const template = await prisma.consentTemplate.findFirst({
      where: {
        id: templateId,
        isActive: true,
        OR: [{ tenantId: null }, { tenantId }],
      },
    });

    if (!template) return apiError("Consent template not found or inactive", 404);

    // Verify patient belongs to tenant
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });

    if (!patient) return apiError("Patient not found", 404);

    const forwarded = request.headers.get("x-forwarded-for");
    const resolvedIp = ipAddress ?? forwarded?.split(",")[0]?.trim() ?? undefined;

    const consent = await prisma.patientConsent.create({
      data: {
        tenantId,
        patientId,
        templateId,
        appointmentId: appointmentId ?? null,
        signatureData,
        ipAddress: resolvedIp ?? null,
      },
      include: {
        template: {
          select: { id: true, title: true, category: true },
        },
      },
    });

    return apiSuccess({ consent }, 201);
  } catch (err) {
    console.error("[POST /api/consent/sign]", err);
    return apiError("Failed to record consent", 500);
  }
}
