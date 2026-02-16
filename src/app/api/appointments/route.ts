// ============================================
// NEXUS DENTAL — Appointments List + Create API
// GET  /api/appointments        — List appointments
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    enforceTenantScope,
    isPatientUser,
    isStaffUser,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import type { JWTPayload, PatientJWTPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");
        const status = searchParams.get("status");
        const doctorId = searchParams.get("doctorId");
        const patientId = searchParams.get("patientId");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        if (!tenantId) {
            return apiError("tenantId is required", 400);
        }

        // Enforce tenant scope
        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        // Build where clause
        const where: Record<string, unknown> = { tenantId };

        // Patients can only see their own appointments
        if (isPatientUser(user)) {
            where.patientId = (user as PatientJWTPayload).patientId;
        } else if (isStaffUser(user)) {
            // Doctors see their own appointments by default
            const staffUser = user as JWTPayload;
            if (staffUser.role === "DOCTOR" && !patientId) {
                where.doctorId = staffUser.userId;
            }
            // Admin/receptionist can filter by doctor or patient
            if (doctorId) where.doctorId = doctorId;
            if (patientId) where.patientId = patientId;
        }

        if (status) {
            where.status = status;
        }

        if (dateFrom || dateTo) {
            where.dateTime = {};
            if (dateFrom) {
                (where.dateTime as Record<string, unknown>).gte = new Date(dateFrom);
            }
            if (dateTo) {
                (where.dateTime as Record<string, unknown>).lte = new Date(dateTo);
            }
        }

        const [appointments, total] = await Promise.all([
            prisma.appointment.findMany({
                where,
                include: {
                    patient: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            phone: true,
                        },
                    },
                    doctor: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            specialty: true,
                        },
                    },
                    service: {
                        select: {
                            id: true,
                            name: true,
                            price: true,
                            category: true,
                            duration: true,
                        },
                    },
                },
                orderBy: { dateTime: "asc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.appointment.count({ where }),
        ]);

        return apiSuccess({
            appointments,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("[Appointments] List error:", error);
        return apiError("Internal server error", 500);
    }
}
