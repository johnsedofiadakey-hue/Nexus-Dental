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

        const tenantId = user.tenantId;
        if (!tenantId) return apiError("No tenant associated with user", 400);

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const search = searchParams.get("search");

        const where: Record<string, unknown> = { tenantId, deletedAt: null };
        if (status) where.status = status;
        if (search) {
            where.patient = {
                OR: [
                    { firstName: { contains: search, mode: "insensitive" } },
                    { lastName: { contains: search, mode: "insensitive" } },
                ],
            };
        }

        const plans = await prisma.treatmentPlan.findMany({
            where,
            include: {
                patient: { select: { id: true, firstName: true, lastName: true } },
                steps: { select: { id: true, status: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const result = plans.map((plan: typeof plans[number]) => ({
            id: plan.id,
            title: plan.title,
            description: plan.description,
            status: plan.status,
            totalCost: plan.totalCost,
            startDate: plan.startDate,
            createdAt: plan.createdAt,
            patient: plan.patient,
            steps: {
                total: plan.steps.length,
                completed: plan.steps.filter((s: { status: string }) => s.status === "COMPLETED").length,
            },
        }));

        return apiSuccess({ plans: result });
    } catch (error) {
        console.error("[TreatmentPlans] GET error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const tenantId = user.tenantId;
        if (!tenantId) return apiError("No tenant associated with user", 400);

        const staffUser = user as JWTPayload;
        const body = await request.json();
        const { patientId, title, description, totalCost, startDate } = body;

        if (!patientId || !title) {
            return apiError("patientId and title are required", 400);
        }

        const plan = await prisma.treatmentPlan.create({
            data: {
                tenantId,
                patientId,
                doctorId: staffUser.userId,
                title,
                description: description ?? null,
                totalCost: totalCost ?? null,
                startDate: startDate ? new Date(startDate) : null,
                status: "ACTIVE",
                steps: {
                    create: [
                        {
                            stepNumber: 1,
                            title: "Initial Assessment",
                            description: "Initial clinical assessment and treatment planning",
                            status: "PENDING",
                        },
                    ],
                },
            },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true } },
                steps: true,
            },
        });

        return apiSuccess({ plan }, 201);
    } catch (error) {
        console.error("[TreatmentPlans] POST error:", error);
        return apiError("Internal server error", 500);
    }
}
