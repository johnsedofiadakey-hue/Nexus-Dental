import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import type { JWTPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const { searchParams } = new URL(request.url);
        const patientId = searchParams.get("patientId");
        const tenantId = user.tenantId;

        if (!patientId) return apiError("patientId is required", 400);
        if (!tenantId) return apiError("No tenant associated with user", 400);

        const records = await prisma.toothRecord.findMany({
            where: { tenantId, patientId },
            orderBy: { toothNumber: "asc" },
        });

        return apiSuccess({ records });
    } catch (error) {
        console.error("[Teeth] GET error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const tenantId = user.tenantId;
        if (!tenantId) return apiError("No tenant associated with user", 400);

        const body = await request.json();
        const { patientId, toothNumber, condition, surfaces, notes } = body;

        if (!patientId || toothNumber === undefined) {
            return apiError("patientId and toothNumber are required", 400);
        }

        const staffUser = user as JWTPayload;
        const doctorId = staffUser.userId;

        const existing = await prisma.toothRecord.findFirst({
            where: { tenantId, patientId, toothNumber },
        });

        const conditionEntry = {
            type: condition,
            surfaces: surfaces ?? [],
            date: new Date().toISOString(),
            notes: notes ?? "",
            doctorId,
        };

        let record;
        if (existing) {
            const existingConditions = Array.isArray(existing.conditions)
                ? existing.conditions as unknown[]
                : [];
            record = await prisma.toothRecord.update({
                where: { id: existing.id },
                data: {
                    conditions: [...existingConditions, conditionEntry],
                    notes: notes ?? existing.notes,
                    updatedAt: new Date(),
                },
            });
        } else {
            record = await prisma.toothRecord.create({
                data: {
                    tenantId,
                    patientId,
                    toothNumber,
                    conditions: [conditionEntry],
                    notes: notes ?? null,
                },
            });
        }

        return apiSuccess({ record });
    } catch (error) {
        console.error("[Teeth] PATCH error:", error);
        return apiError("Internal server error", 500);
    }
}
