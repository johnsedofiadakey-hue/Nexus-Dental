import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import type { JWTPayload, PatientJWTPayload } from "@/lib/auth";
import prisma from "@/lib/db/prisma";
import { getTenantIdFromUser } from "@/lib/clinic";

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const { searchParams } = new URL(request.url);
        let patientId = searchParams.get("patientId");

        // Tenant and patient resolution
        if (user.type === "PATIENT") {
            const patientUser = user as PatientJWTPayload;
            // Patients can only fetch their own files
            if (patientId && patientId !== patientUser.patientId) {
                return apiError("Forbidden", 403);
            }
            patientId = patientUser.patientId;
        } else {
            // Staff must provide a patientId
            if (!patientId) return apiError("patientId is required", 400);
        }

        const files = await prisma.patientFile.findMany({
            where: { 
                tenantId: getTenantIdFromUser(user),
                patientId
            },
            include: {
                uploadedBy: { select: { firstName: true, lastName: true, roles: { select: { systemRole: true } } } }
            },
            orderBy: { createdAt: "desc" }
        });

        return apiSuccess({ files });
    } catch (error) {
        console.error("[Patient Files API] GET Error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const body = await request.json();
        let { patientId, appointmentId, filename, fileType, fileSize, storageKey, category, notes } = body;

        if (user.type === "PATIENT") {
            const patientUser = user as PatientJWTPayload;
            if (patientId && patientId !== patientUser.patientId) {
                return apiError("Forbidden", 403);
            }
            patientId = patientUser.patientId;
            
            // For now, patients are not 'uploaders' in the sense of the User table,
            // but the schema requires an uploadedById linking to a User (staff).
            // Wait, looking at the schema: `uploadedBy User @relation("FileUploader", fields: [uploadedById], references: [id])`
            // That means a Patient cannot be the uploadedBy because it maps to the User table.
            // A staff member must upload it, or we need to change the schema or use a system user ID.
            return apiError("Currently, only staff can upload files", 403);
        } else {
            if (!patientId) return apiError("patientId is required", 400);
        }

        if (!filename || !fileType || !fileSize || !storageKey || !category) {
            return apiError("Missing required file metadata", 400);
        }

        // Validate patient belongs to tenant
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, tenantId: getTenantIdFromUser(user) }
        });
        if (!patient) return apiError("Patient not found", 404);

        const staffUser = user as JWTPayload;

        const file = await prisma.patientFile.create({
            data: {
                tenantId: getTenantIdFromUser(user),
                patientId,
                appointmentId: appointmentId || null,
                uploadedById: staffUser.userId,
                filename,
                fileType,
                fileSize: Number(fileSize),
                storageKey,
                category,
                notes: notes || null
            },
            include: {
                uploadedBy: { select: { firstName: true, lastName: true, roles: { select: { systemRole: true } } } }
            }
        });

        return apiSuccess({ file }, 201);
    } catch (error) {
        console.error("[Patient Files API] POST Error:", error);
        return apiError("Internal server error", 500);
    }
}
