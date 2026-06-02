// ============================================
// NEXUS DENTAL — Single Consent Template
// GET    /api/consent/[id] — fetch template or signed consent
// DELETE /api/consent/[id] — delete custom template (not global)
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
  requireAuth,
  apiError,
  apiSuccess,
} from "@/lib/auth";
import { getClinicId } from "@/lib/clinic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;

    const { id } = await params;
    const tenantId = getClinicId();

    // Try as a ConsentTemplate first
    const template = await prisma.consentTemplate.findFirst({
      where: {
        id,
        OR: [{ tenantId: null }, { tenantId }],
      },
    });

    if (template) return apiSuccess({ type: "template", data: template });

    // Try as a PatientConsent
    const consent = await prisma.patientConsent.findFirst({
      where: { id, tenantId },
      include: {
        template: true,
        patient: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (consent) return apiSuccess({ type: "consent", data: consent });

    return apiError("Not found", 404);
  } catch (err) {
    console.error("[GET /api/consent/[id]]", err);
    return apiError("Failed to fetch consent record", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;

    const { id } = await params;
    const tenantId = getClinicId();

    const template = await prisma.consentTemplate.findUnique({
      where: { id },
    });

    if (!template) return apiError("Template not found", 404);

    // Prevent deletion of global (system) templates
    if (template.tenantId === null) {
      return apiError("Global consent templates cannot be deleted", 403);
    }

    // Ensure template belongs to this tenant
    if (template.tenantId !== tenantId) {
      return apiError("Forbidden", 403);
    }

    await prisma.consentTemplate.delete({ where: { id } });

    return apiSuccess({ message: "Template deleted successfully" });
  } catch (err) {
    console.error("[DELETE /api/consent/[id]]", err);
    return apiError("Failed to delete consent template", 500);
  }
}
