import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSystemOwner } from "@/lib/auth/middleware";

// PATCH /api/system/reviews/[id] - Approve or Moderate a review
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await requireSystemOwner(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json();
        const { isApproved } = body;

        const review = await prisma.review.update({
            where: { id: params.id },
            data: { isApproved },
        });

        return NextResponse.json({ success: true, data: review });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Review not found" }, { status: 404 });
    }
}

// DELETE /api/system/reviews/[id] - Remove a review
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await requireSystemOwner(req);
    if (auth instanceof NextResponse) return auth;

    try {
        await prisma.review.delete({
            where: { id: params.id },
        });
        return NextResponse.json({ success: true, message: "Review deleted" });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Review not found" }, { status: 404 });
    }
}
