import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authenticateRequest } from "@/lib/auth/middleware";

// GET /api/reviews - Get approved reviews for a tenant
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get("tenantId");

        if (!tenantId) {
            return NextResponse.json({ success: false, error: "tenantId required" }, { status: 400 });
        }

        const reviews = await prisma.review.findMany({
            where: {
                tenantId,
                isApproved: true,
            },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        return NextResponse.json({ success: true, data: reviews });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

// POST /api/reviews - Submit a new review (pending approval)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { tenantId, patientId, authorName, rating, comment } = body;

        if (!tenantId || !authorName || !rating || !comment) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const review = await prisma.review.create({
            data: {
                tenantId,
                patientId,
                authorName,
                rating,
                comment,
                isApproved: false, // Moderated by default
            },
        });

        return NextResponse.json({ success: true, data: review, message: "Review submitted for approval" });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
