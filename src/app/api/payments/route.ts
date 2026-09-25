import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    requirePermission,
    isPatientUser,
    PERMISSIONS,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import type { PatientJWTPayload } from "@/lib/auth";
import { getTenantIdFromUser } from "@/lib/clinic";
import { initiateHubtelCheckout } from "@/lib/payments/hubtel";

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const body = await request.json();
        const { invoiceId, phone } = body as { invoiceId: string; phone: string };

        if (!invoiceId) {
            return apiError("Invoice ID is required", 400);
        }

        const tenantId = getTenantIdFromUser(user);
        const patientId = isPatientUser(user)
            ? (user as PatientJWTPayload).patientId
            : undefined;

        if (!isPatientUser(user)) {
            const permissionError = requirePermission(user, PERMISSIONS.BILLING_CREATE);
            if (permissionError) return permissionError;
        }

        const invoice = await prisma.invoice.findFirst({
            where: {
                id: invoiceId,
                tenantId,
                ...(patientId ? { patientId } : {}),
            },
            include: { appointment: { include: { patient: true } } }
        });

        if (!invoice) {
            return apiError("Invoice not found", 404);
        }

        if (invoice.status === "PAID") {
            return apiError("Invoice is already paid", 400);
        }

        // Call Hubtel
        const paymentResult = await initiateHubtelCheckout({
            amount: invoice.totalAmount,
            title: "Nexus Dental Payment",
            description: `Payment for Invoice #${invoice.id.substring(0, 8).toUpperCase()}`,
            clientReference: invoice.id,
            customerPhone: phone || invoice.appointment?.patient?.phone || "000000000",
            callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://nexusdental.app"}/api/payments/callback`,
        });

        if (!paymentResult.success) {
            return apiError(paymentResult.error || "Unable to initialize payment", 502);
        }

        if (!paymentResult.checkoutUrl) {
            return apiError("Online payments are not configured", 503);
        }

        return apiSuccess({
            checkoutUrl: paymentResult.checkoutUrl 
        });

    } catch (err) {
        console.error("[payments/post]", err);
        return apiError("Internal server error", 500);
    }
}
