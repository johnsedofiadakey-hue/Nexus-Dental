// ============================================
// NEXUS DENTAL — Patient Detail API
// GET   /api/patients/[id] — Get patient with history
// PATCH /api/patients/[id] — Update patient info
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    enforceTenantScope,
    requirePermission,
    PERMISSIONS,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import type { JWTPayload } from "@/lib/auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.PATIENTS_VIEW);
        if (permCheck) return permCheck;

        const patient = await prisma.patient.findUnique({
            where: { id },
            include: {
                appointments: {
                    include: {
                        doctor: {
                            select: { id: true, firstName: true, lastName: true },
                        },
                        service: {
                            select: { id: true, name: true, category: true },
                        },
                    },
                    orderBy: { dateTime: "desc" },
                    take: 20,
                },
                prescriptions: {
                    include: {
                        doctor: {
                            select: { id: true, firstName: true, lastName: true },
                        },
                    },
                    orderBy: { issuedAt: "desc" },
                    take: 10,
                },
                invoices: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                },
            },
        });

        if (!patient) {
            return apiError("Patient not found", 404);
        }

        const tenantCheck = enforceTenantScope(user, patient.tenantId);
        if (tenantCheck) return tenantCheck;

        return apiSuccess(patient);
    } catch (error) {
        console.error("[Patient] Detail error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.PATIENTS_UPDATE);
        if (permCheck) return permCheck;

        const staffUser = user as JWTPayload;

        const patient = await prisma.patient.findUnique({ where: { id } });
        if (!patient) {
            return apiError("Patient not found", 404);
        }

        const tenantCheck = enforceTenantScope(user, patient.tenantId);
        if (tenantCheck) return tenantCheck;

        const body = await request.json();
        const allowedFields = [
            "firstName",
            "lastName",
            "email",
            "dateOfBirth",
            "gender",
            "address",
            "bloodType",
            "allergies",
            "medicalNotes",
            "insuranceProvider",
            "insurancePolicyNo",
        ];

        const data: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                data[field] =
                    field === "dateOfBirth" && body[field]
                        ? new Date(body[field])
                        : body[field];
            }
        }

        if (Object.keys(data).length === 0) {
            return apiError("No valid fields to update", 400);
        }

        const updated = await prisma.patient.update({
            where: { id },
            data,
        });

        // Audit
        await prisma.auditLog.create({
            data: {
                tenantId: patient.tenantId,
                userId: staffUser.userId,
                action: "PATIENT_UPDATED",
                entity: "Patient",
                entityId: id,
                oldValue: JSON.parse(JSON.stringify(
                    Object.fromEntries(
                        Object.keys(data).map((k) => [
                            k,
                            patient[k as keyof typeof patient],
                        ])
                    )
                )),
                newValue: JSON.parse(JSON.stringify(data)),
            },
        });

        return apiSuccess(updated);
    } catch (error) {
        console.error("[Patient] Update error:", error);
        return apiError("Internal server error", 500);
    }
}
