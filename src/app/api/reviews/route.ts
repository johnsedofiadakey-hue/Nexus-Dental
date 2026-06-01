import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { authenticateRequest, apiError, apiSuccess, requireAuth, isPatientUser } from "@/lib/auth";
import type { PatientJWTPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");
        const all = searchParams.get("all") === "true"; // staff can see unapproved

        if (!tenantId) return apiError("tenantId required", 400);

        const where: any = { tenantId };
        if (!all) where.isApproved = true;

        const reviews = await prisma.review.findMany({
            where,
            include: { patient: { select: { firstName: true, lastName: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        return apiSuccess({ reviews });
    } catch (error) {
        return apiError("Internal server error", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tenantId, authorName, rating, comment } = body;

        if (!tenantId || !authorName || !rating || !comment) {
            return apiError("tenantId, authorName, rating, and comment are required", 400);
        }

        if (rating < 1 || rating > 5) return apiError("Rating must be 1–5", 400);

        // Try to link to patient if authenticated
        let patientId: string | null = null;
        const user = authenticateRequest(request);
        if (user && isPatientUser(user)) {
            patientId = (user as PatientJWTPayload).patientId;
        }

        const review = await prisma.review.create({
            data: { tenantId, patientId, authorName, rating, comment, isApproved: false },
        });

        return apiSuccess(review, 201);
    } catch (error) {
        return apiError("Internal server error", 500);
    }
}
