import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import type { JWTPayload } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getClinicId } from "@/lib/clinic";
import { LabOrderStatus } from "@prisma/client";

const STATUS_PROGRESSION: Record<string, LabOrderStatus> = {
    ORDERED: "LAB_RECEIVED",
    LAB_RECEIVED: "IN_FABRICATION",
    IN_FABRICATION: "READY",
    READY: "FITTED",
};

/**
 * PATCH /api/lab-orders/[id]
 * Update status and any fields
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const user = authResult.user as JWTPayload;

        const { id } = await params;
        const body = await request.json();

        // Verify ownership
        const existing = await prisma.labOrder.findFirst({ where: { id, tenantId: getClinicId() } });
        if (!existing) return apiError("Lab order not found", 404);

        const {
            status,
            labName,
            labContact,
            labEmail,
            toothNumbers,
            restoration,
            material,
            shade,
            instructions,
            dueAt,
            cost,
            notes,
        } = body;

        // Auto-set timestamps
        const autoTimestamps: { receivedAt?: Date; fittedAt?: Date } = {};
        if (status === "LAB_RECEIVED" && !existing.receivedAt) {
            autoTimestamps.receivedAt = new Date();
        }
        if (status === "FITTED" && !existing.fittedAt) {
            autoTimestamps.fittedAt = new Date();
        }

        const updated = await prisma.labOrder.update({
            where: { id },
            data: {
                ...(status ? { status: status as LabOrderStatus } : {}),
                ...(labName !== undefined ? { labName } : {}),
                ...(labContact !== undefined ? { labContact } : {}),
                ...(labEmail !== undefined ? { labEmail } : {}),
                ...(toothNumbers !== undefined ? { toothNumbers } : {}),
                ...(restoration !== undefined ? { restoration } : {}),
                ...(material !== undefined ? { material } : {}),
                ...(shade !== undefined ? { shade } : {}),
                ...(instructions !== undefined ? { instructions } : {}),
                ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}),
                ...(cost !== undefined ? { cost: cost != null ? Number(cost) : null } : {}),
                ...(notes !== undefined ? { notes } : {}),
                ...autoTimestamps,
            },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true } },
                doctor: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        return apiSuccess(updated);
    } catch (error: any) {
        console.error("[Lab Orders API] PATCH Error:", error);
        return apiError(error.message || "Internal Server Error", 500);
    }
}

/**
 * DELETE /api/lab-orders/[id]
 * Soft cancel — set status to CANCELLED
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const user = authResult.user as JWTPayload;

        const { id } = await params;

        const existing = await prisma.labOrder.findFirst({ where: { id, tenantId: getClinicId() } });
        if (!existing) return apiError("Lab order not found", 404);
        if (existing.status === "CANCELLED") return apiError("Lab order is already cancelled", 400);

        const updated = await prisma.labOrder.update({
            where: { id },
            data: { status: "CANCELLED" },
        });

        return apiSuccess({ message: "Lab order cancelled", id: updated.id });
    } catch (error: any) {
        console.error("[Lab Orders API] DELETE Error:", error);
        return apiError(error.message || "Internal Server Error", 500);
    }
}
