import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    requirePermission,
    enforceTenantScope,
    PERMISSIONS,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import { verifyPayment } from "@/lib/payments/paystack";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permissionError = requirePermission(user, PERMISSIONS.BILLING_UPDATE);
        if (permissionError) return permissionError;

        const body = await request.json();
        const { method = "CASH", paystackRef } = body;

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return apiError("Invoice not found", 404);

        const tenantCheck = enforceTenantScope(user, invoice.tenantId);
        if (tenantCheck) return tenantCheck;

        if (invoice.status === "PAID") return apiError("Invoice already paid", 400);

        let paymentMethod = method;
        let noteLine: string | null = null;

        if (method === "PAYSTACK" || paystackRef) {
            // A card/Paystack payment claim must be verified against Paystack directly —
            // never trust a client-supplied reference string as proof of payment.
            if (!paystackRef) {
                return apiError("paystackRef is required to record a Paystack payment", 400);
            }
            const txn = await verifyPayment(paystackRef);
            if (txn.status !== "success") {
                return apiError("Paystack reference could not be verified as a successful payment", 400);
            }
            paymentMethod = "PAYSTACK";
            noteLine = `Paystack ref: ${paystackRef} (verified)`;
        } else {
            // Manual/cash override — explicitly logged as staff-attested, not verified.
            paymentMethod = "CASH";
            noteLine = "Manual/cash payment recorded by staff (not independently verified)";
        }

        const updated = await prisma.invoice.update({
            where: { id },
            data: {
                status: "PAID",
                paidAt: new Date(),
                paymentMethod,
                paystackRef: paymentMethod === "PAYSTACK" ? paystackRef : invoice.paystackRef,
                notes: noteLine ? `${invoice.notes || ""}\n${noteLine}`.trim() : invoice.notes,
            },
        });

        return apiSuccess(updated);
    } catch (error) {
        console.error("[Invoices] Pay error:", error);
        return apiError("Internal server error", 500);
    }
}
