import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, enforceTenantScope, apiError, apiSuccess } from "@/lib/auth";

// PATCH /api/invoices/[id]/claim — update insurance claim fields on an invoice
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return apiError("Invoice not found", 404);

        const tenantCheck = enforceTenantScope(user, invoice.tenantId);
        if (tenantCheck) return tenantCheck;

        const body = await request.json();
        const {
            insuranceClaim,
            insuranceProvider,
            insurancePolicyNo,
            insuranceClaimRef,
            insuranceClaimAmount,
            insuranceClaimStatus,
            insuranceClaimNotes,
        } = body;

        const validStatuses = ["PENDING", "SUBMITTED", "APPROVED", "REJECTED", "PARTIAL"];
        if (insuranceClaimStatus && !validStatuses.includes(insuranceClaimStatus)) {
            return apiError(`insuranceClaimStatus must be one of: ${validStatuses.join(", ")}`, 400);
        }

        const updated = await prisma.invoice.update({
            where: { id },
            data: {
                insuranceClaim: insuranceClaim ?? undefined,
                insuranceProvider: insuranceProvider ?? undefined,
                insurancePolicyNo: insurancePolicyNo ?? undefined,
                insuranceClaimRef: insuranceClaimRef ?? undefined,
                insuranceClaimAmount: insuranceClaimAmount !== undefined ? parseFloat(insuranceClaimAmount) : undefined,
                insuranceClaimStatus: insuranceClaimStatus ?? undefined,
                insuranceClaimNotes: insuranceClaimNotes ?? undefined,
                insuranceClaimDate: insuranceClaimStatus === "SUBMITTED" ? new Date() : undefined,
            },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        return apiSuccess(updated);
    } catch (error) {
        console.error("[Claim] PATCH error:", error);
        return apiError("Internal server error", 500);
    }
}
