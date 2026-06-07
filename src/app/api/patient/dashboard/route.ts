import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, apiError, apiSuccess, PatientJWTPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        
        const user = authResult.user;
        if (user.type !== "PATIENT") {
            return apiError("Only patients can access this resource", 403);
        }

        const patientId = (user as PatientJWTPayload).patientId;

        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            include: {
                appointments: {
                    orderBy: { dateTime: 'desc' },
                    include: {
                        doctor: { select: { firstName: true, lastName: true } },
                        service: { select: { name: true } },
                        additionalServices: { select: { name: true } },
                    }
                }
            }
        });

        if (!patient) return apiError("Patient not found", 404);

        return apiSuccess({ patient });
    } catch (error) {
        console.error("[Patient Dashboard]", error);
        return apiError("Internal server error", 500);
    }
}
