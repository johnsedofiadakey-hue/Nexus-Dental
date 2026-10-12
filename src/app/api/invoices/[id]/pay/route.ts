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
import { featureDisabledResponse, resolveProviders } from "@/lib/config/features";
import { reconcilePaystackReference } from "@/lib/payments/reconcile";

// The only ways this endpoint can record a payment. Anything else is REFUSED, never relabelled:
// recording a card/mobile-money/transfer payment as "CASH" would make the books lie.
const SUPPORTED_METHODS = ["CASH", "PAYSTACK"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = await requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permissionError = requirePermission(user, PERMISSIONS.BILLING_UPDATE);
        if (permissionError) return permissionError;

        const body = await request.json();
        const { paystackRef } = body;
        const method = typeof body.method === "string" ? body.method.trim().toUpperCase() : body.method === undefined ? "CASH" : null;

        if (method === null || !SUPPORTED_METHODS.includes(method)) {
            return Response.json(
                { success: false, error: `Unsupported payment method. Supported: ${SUPPORTED_METHODS.join(", ")}.`, code: "UNSUPPORTED_PAYMENT_METHOD", supported: SUPPORTED_METHODS },
                { status: 400 }
            );
        }
        if (method === "CASH" && paystackRef) {
            return apiError("A Paystack reference cannot be recorded as a cash payment", 400);
        }

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return apiError("Invoice not found", 404);

        const tenantCheck = enforceTenantScope(user, invoice.tenantId);
        if (tenantCheck) return tenantCheck;

        if (invoice.status === "PAID") return apiError("Invoice already paid", 400);

        let paymentMethod: string = method;
        let noteLine: string | null = null;

        if (method === "PAYSTACK") {
            // Online payments exist only where the clinic's deployment has Paystack configured and enabled.
            const paystack = resolveProviders().paystack;
            if (!paystack.enabled) return featureDisabledResponse("paystack", paystack.reason);
            // A card/Paystack payment claim must be verified against Paystack directly —
            // never trust a client-supplied reference string as proof of payment.
            if (!paystackRef) {
                return apiError("paystackRef is required to record a Paystack payment", 400);
            }
            const outcome = await reconcilePaystackReference(paystackRef);
            if (!(outcome.result === "PAID" || outcome.result === "ALREADY_PAID") || outcome.invoiceId !== invoice.id) {
                return apiError("Paystack reference does not represent a matching successful payment for this invoice", 400);
            }
            return apiSuccess(await prisma.invoice.findUnique({ where: { id: invoice.id } }));
        } else {
            // Cash — explicitly logged as staff-attested, not verified.
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
