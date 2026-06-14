import { NextRequest } from "next/server";
import { requireAuth, isStaffUser, apiError, apiSuccess } from "@/lib/auth";
import type { JWTPayload } from "@/lib/auth";
import prisma from "@/lib/db/prisma";
import { getTenantIdFromUser } from "@/lib/clinic";

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;
        
        if (!isStaffUser(user)) return apiError("Staff access required", 403);

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const invoiceId = searchParams.get("invoiceId");
        
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");

        const where: any = { tenantId: getTenantIdFromUser(user), deletedAt: null };
        if (status) where.status = status;
        if (invoiceId) where.invoiceId = invoiceId;

        const [claims, total] = await Promise.all([
            prisma.insuranceClaim.findMany({
                where,
                include: {
                    invoice: {
                        select: { id: true, amount: true, patient: { select: { id: true, firstName: true, lastName: true } } }
                    }
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.insuranceClaim.count({ where })
        ]);

        return apiSuccess({
            data: claims,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("[Insurance Claims API] GET Error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;
        
        if (!isStaffUser(user)) return apiError("Staff access required", 403);

        const body = await request.json();
        const { invoiceId, provider, policyNo, claimedAmount, notes } = body;

        if (!invoiceId || !provider || !claimedAmount) {
            return apiError("invoiceId, provider, and claimedAmount are required", 400);
        }

        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, tenantId: getTenantIdFromUser(user) }
        });

        if (!invoice) return apiError("Invoice not found", 404);

        const claim = await prisma.insuranceClaim.create({
            data: {
                tenantId: getTenantIdFromUser(user),
                invoiceId,
                provider,
                policyNo: policyNo || null,
                claimedAmount: Number(claimedAmount),
                notes: notes || null,
                status: "SUBMITTED"
            }
        });

        // Update the invoice to reflect that an insurance claim exists
        await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                insuranceClaim: true,
                insuranceProvider: provider,
                insurancePolicyNo: policyNo || null,
                insuranceClaimAmount: Number(claimedAmount),
                insuranceClaimStatus: "SUBMITTED",
                insuranceClaimDate: new Date()
            }
        });

        return apiSuccess({ claim }, 201);
    } catch (error) {
        console.error("[Insurance Claims API] POST Error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;
        
        if (!isStaffUser(user)) return apiError("Staff access required", 403);

        const body = await request.json();
        const { id, status, approvedAmount, claimRef, notes } = body;

        if (!id || !status) {
            return apiError("id and status are required", 400);
        }

        const existingClaim = await prisma.insuranceClaim.findFirst({
            where: { id, tenantId: getTenantIdFromUser(user) }
        });

        if (!existingClaim) return apiError("Claim not found", 404);

        const isResolved = ["APPROVED", "REJECTED", "PARTIAL"].includes(status);

        const claim = await prisma.insuranceClaim.update({
            where: { id },
            data: {
                status,
                approvedAmount: approvedAmount != null ? Number(approvedAmount) : undefined,
                claimRef: claimRef !== undefined ? claimRef : undefined,
                notes: notes !== undefined ? notes : undefined,
                resolvedAt: isResolved ? new Date() : undefined
            }
        });

        // Sync back to invoice
        await prisma.invoice.update({
            where: { id: existingClaim.invoiceId },
            data: {
                insuranceClaimStatus: status,
                insuranceClaimRef: claimRef !== undefined ? claimRef : undefined
            }
        });

        return apiSuccess({ claim });
    } catch (error) {
        console.error("[Insurance Claims API] PATCH Error:", error);
        return apiError("Internal server error", 500);
    }
}
