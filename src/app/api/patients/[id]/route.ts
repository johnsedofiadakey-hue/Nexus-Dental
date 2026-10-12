// ============================================
// NEXUS DENTAL — Patient Detail API
// GET   /api/patients/[id] — Get patient with history
// PATCH /api/patients/[id] — Update patient info
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    requirePermission,
    PERMISSIONS,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import type { JWTPayload } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { normalizePhone, phoneLookupVariants } from "@/lib/phone";
import { revokePatientSessions } from "@/lib/auth/session";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authResult = await requireAuth(request);
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
                        additionalServices: {
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

        const staffUser = user as JWTPayload;
        if (patient.tenantId !== staffUser.tenantId) {
            return apiError("Patient not found", 404);
        }

        const appointments = patient.appointments.map(({ service, additionalServices, ...appt }: any) => ({
            ...appt,
            services: [service, ...(additionalServices || [])].filter(Boolean),
        }));

        return apiSuccess({ ...patient, appointments });
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
        const authResult = await requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.PATIENTS_UPDATE);
        if (permCheck) return permCheck;

        const staffUser = user as JWTPayload;

        const patient = await prisma.patient.findUnique({ where: { id } });
        if (!patient) {
            return apiError("Patient not found", 404);
        }

        if (patient.tenantId !== staffUser.tenantId) {
            return apiError("Patient not found", 404);
        }

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
            "phone",
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

        // The phone number is the patient's sign-in identity. It is stored in one canonical form, must
        // not belong to another patient (under ANY historical spelling), and changing it signs the
        // patient out everywhere.
        let phoneChanged = false;
        if (data.phone !== undefined) {
            const normalized = normalizePhone(data.phone);
            if (!normalized.ok) {
                return apiError("Please enter a valid phone number", 400);
            }
            const clash = await prisma.patient.findFirst({
                where: { tenantId: patient.tenantId, id: { not: id }, phone: { in: phoneLookupVariants(normalized.e164) } },
                select: { id: true },
            });
            if (clash) {
                return apiError("A patient with this phone number already exists", 409);
            }
            data.phone = normalized.e164;
            phoneChanged = patient.phone !== normalized.e164;
            if (!phoneChanged) delete data.phone;
        }

        if (Object.keys(data).length === 0) {
            return phoneChanged === false && body.phone !== undefined ? apiSuccess(patient) : apiError("No valid fields to update", 400);
        }

        const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const row = await tx.patient.update({ where: { id }, data });
            if (phoneChanged) await revokePatientSessions(tx, id, "PHONE_CHANGED");
            return row;
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
