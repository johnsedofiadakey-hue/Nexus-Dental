import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/auth";
import { PharmacyService } from "@/lib/services/pharmacy.service";

/**
 * PATCH /api/prescriptions/[id]/fulfill
 * Mark a prescription as fulfilled and deduct from inventory
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = authenticateRequest(request);
        if (!user || !user.tenantId) {
            return apiError("Unauthorized", 401);
        }

        // Verify role (Pharmacist, Inventory Manager, Owner, or Admin)
        const allowedRoles = ["SYSTEM_OWNER", "CLINIC_OWNER", "ADMIN", "INVENTORY_MANAGER", "RECEPTIONIST", "BILLING_STAFF"];
        const userRole = "role" in user ? user.role : "PATIENT";
        if (!allowedRoles.includes(userRole)) {
            return apiError("Forbidden: You do not have permission to fulfill prescriptions", 403);
        }

        const prescriptionId = params.id;
        const result = await PharmacyService.fulfillPrescription(prescriptionId, user.tenantId);


        return apiSuccess(result, "Prescription fulfilled and inventory updated successfully");
    } catch (error: any) {
        console.error("[Prescriptions Fulfillment API] PATCH Error:", error);
        return apiError(error.message || "Internal Server Error", 500);
    }
}
