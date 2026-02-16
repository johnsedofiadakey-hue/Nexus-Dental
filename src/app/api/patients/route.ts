// ============================================
// NEXUS DENTAL — Patient Management API
// GET  /api/patients — List patients
// POST /api/patients — Create patient
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

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.PATIENTS_VIEW);
        if (permCheck) return permCheck;

        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");
        const search = searchParams.get("search");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        if (!tenantId) return apiError("tenantId is required", 400);

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        const where: Record<string, unknown> = { tenantId };

        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
                { email: { contains: search, mode: "insensitive" } },
            ];
        }

        const [patients, total] = await Promise.all([
            prisma.patient.findMany({
                where,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    email: true,
                    dateOfBirth: true,
                    gender: true,
                    bloodType: true,
                    allergies: true,
                    insuranceProvider: true,
                    isVerified: true,
                    lastVisitAt: true,
                    createdAt: true,
                    _count: {
                        select: { appointments: true },
                    },
                },
                orderBy: { lastName: "asc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.patient.count({ where }),
        ]);

        return apiSuccess({
            patients,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("[Patients] List error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.PATIENTS_CREATE);
        if (permCheck) return permCheck;

        const staffUser = user as JWTPayload;
        const body = await request.json();
        const {
            tenantId,
            firstName,
            lastName,
            phone,
            email,
            dateOfBirth,
            gender,
            address,
            bloodType,
            allergies,
            medicalNotes,
            insuranceProvider,
            insurancePolicyNo,
        } = body;

        if (!tenantId || !firstName || !lastName || !phone) {
            return apiError(
                "tenantId, firstName, lastName, and phone are required",
                400
            );
        }

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        // Check for duplicate phone in tenant
        const existing = await prisma.patient.findFirst({
            where: { tenantId, phone },
        });

        if (existing) {
            return apiError("A patient with this phone number already exists", 409);
        }

        const patient = await prisma.patient.create({
            data: {
                tenantId,
                firstName,
                lastName,
                phone,
                email: email || null,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                gender: gender || null,
                address: address || null,
                bloodType: bloodType || null,
                allergies: allergies || null,
                medicalNotes: medicalNotes || null,
                insuranceProvider: insuranceProvider || null,
                insurancePolicyNo: insurancePolicyNo || null,
            },
        });

        // Audit
        await prisma.auditLog.create({
            data: {
                tenantId,
                userId: staffUser.userId,
                action: "PATIENT_CREATED",
                entity: "Patient",
                entityId: patient.id,
                newValue: { firstName, lastName, phone },
            },
        });

        return apiSuccess(patient, 201);
    } catch (error) {
        console.error("[Patients] Create error:", error);
        return apiError("Internal server error", 500);
    }
}
