// ============================================
// NEXUS DENTAL — Patient Signed Consents
// GET  /api/consent/patient?patientId=X&tenantId=X
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
  requireAuth,
  apiError,
  apiSuccess,
} from "@/lib/auth";
import { getClinicId } from "@/lib/clinic";

export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;

    const tenantId = getClinicId();
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) return apiError("patientId is required", 400);

    const consents = await prisma.patientConsent.findMany({
      where: { patientId, tenantId },
      include: {
        template: {
          select: { id: true, title: true, category: true, version: true },
        },
      },
      orderBy: { signedAt: "desc" },
    });

    return apiSuccess({ consents });
  } catch (err) {
    console.error("[GET /api/consent/patient]", err);
    return apiError("Failed to fetch patient consents", 500);
  }
}
