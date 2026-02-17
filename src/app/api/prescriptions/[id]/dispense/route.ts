// ============================================
// NEXUS DENTAL — Prescription Dispensing API
// POST /api/prescriptions/[id]/dispense
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, apiError, apiSuccess, JWTPayload } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const auth = requireAuth(request);
        if ("error" in auth) return auth.error;

        const tenantId = auth.user.tenantId;
        if (!tenantId) {
            return apiError("Tenant context required", 400);
        }

        // Fetch prescription
        const prescription = await prisma.prescription.findUnique({
            where: { id },
            include: {
                patient: true,
            }
        });

        if (!prescription) {
            return apiError("Prescription not found", 404);
        }

        if (prescription.tenantId !== tenantId) {
            return apiError("Access denied", 403);
        }

        if (prescription.status === "DISPENSED") {
            return apiError("Prescription already dispensed", 400);
        }

        if (prescription.status === "CANCELLED") {
            return apiError("Cannot dispense a cancelled prescription", 400);
        }

        const medications = prescription.medications as any[];

        // Execute atomic transaction: Update items, log transactions, mark as dispensed
        const result = await prisma.$transaction(async (tx: any) => {
            const userId = (auth.user as JWTPayload).userId;

            // 1. Process each medication for inventory deduction
            for (const med of medications) {
                if (med.inventoryId) {
                    const item = await tx.inventoryItem.findUnique({
                        where: { id: med.inventoryId }
                    });

                    if (!item) {
                        throw new Error(`Inventory item ${med.name} not found`);
                    }

                    if (item.quantity < (med.quantity || 1)) {
                        throw new Error(`Insufficient stock for ${med.name}. Available: ${item.quantity}`);
                    }

                    // Deduct stock
                    await tx.inventoryItem.update({
                        where: { id: item.id },
                        data: { quantity: { decrement: med.quantity || 1 } }
                    });

                    // Log inventory transaction
                    await tx.inventoryTransaction.create({
                        data: {
                            tenantId,
                            inventoryItemId: item.id,
                            userId,
                            type: "DISPENSED",
                            quantity: med.quantity || 1,
                            notes: `Dispensed for Prescription #${prescription.id} (Patient: ${prescription.patient.firstName} ${prescription.patient.lastName})`,
                        }
                    });
                }
            }

            // 2. Mark prescription as dispensed
            const updatedPrescription = await tx.prescription.update({
                where: { id },
                data: {
                    status: "DISPENSED",
                    dispensedAt: new Date(),
                    dispensedById: userId,
                }
            });

            return updatedPrescription;
        });

        // Log audit
        await logAudit({
            tenantId,
            userId: (auth.user as JWTPayload).userId,
            action: "PRESCRIPTION_DISPENSED",
            entity: "Prescription",
            entityId: id,
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        return apiSuccess(result);
    } catch (error: any) {
        console.error("[PrescriptionDispense] Error:", error);
        return apiError(error.message || "Failed to dispense prescription", 500);
    }
}
