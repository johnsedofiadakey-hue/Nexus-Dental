// ============================================
// NEXUS DENTAL — Patient Signed Consents
// GET  /api/consent/patient?patientId=X&tenantId=X
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
  requireAuth,
  requirePermission,
  PERMISSIONS,
  isPatientUser,
  apiError,
  apiSuccess,
} from "@/lib/auth";
import type { PatientJWTPayload } from "@/lib/auth";
import { getTenantIdFromUser } from "@/lib/clinic";

export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;

    const tenantId = getTenantIdFromUser(user);
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) return apiError("patientId is required", 400);

    if (isPatientUser(user)) {
      // A patient may only read their own consent records.
      if ((user as PatientJWTPayload).patientId !== patientId) {
        return apiError("Forbidden", 403);
      }
    } else {
      const permissionError = requirePermission(user, PERMISSIONS.PATIENTS_VIEW);
      if (permissionError) return permissionError;
    }

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
