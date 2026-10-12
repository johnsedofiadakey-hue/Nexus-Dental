import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { apiError, apiSuccess, isPatientUser, PERMISSIONS, requireAuth, requirePermission } from "@/lib/auth";
import type { PatientJWTPayload } from "@/lib/auth";
import { featureDisabledResponse, resolveProviders } from "@/lib/config/features";
import { reconcilePaystackReference } from "@/lib/payments/reconcile";

/** Authenticated callback reconciliation after Paystack redirects the browser. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = await requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const paystack = resolveProviders().paystack;
        if (!paystack.enabled) return featureDisabledResponse("paystack", paystack.reason);

        const body = await request.json().catch(() => ({}));
        const reference = typeof body.reference === "string" ? body.reference.trim() : "";
        if (!reference) return apiError("reference is required", 400);

        const invoice = await prisma.invoice.findUnique({ where: { id }, select: { id: true, tenantId: true, patientId: true } });
        if (!invoice) return apiError("Invoice not found", 404);
        if (isPatientUser(user)) {
            if (invoice.patientId !== (user as PatientJWTPayload).patientId) return apiError("Invoice not found", 404);
        } else {
            if (invoice.tenantId !== user.tenantId) return apiError("Invoice not found", 404);
            const denied = requirePermission(user, PERMISSIONS.BILLING_VIEW);
            if (denied) return denied;
        }

        const attempt = await prisma.paymentAttempt.findUnique({ where: { reference }, select: { invoiceId: true } });
        if (attempt ? attempt.invoiceId !== invoice.id : false) return apiError("Payment reference does not belong to this invoice", 404);
        if (!attempt) {
            const legacy = await prisma.invoice.findFirst({ where: { id: invoice.id, paystackRef: reference }, select: { id: true } });
            if (!legacy) return apiError("Payment reference does not belong to this invoice", 404);
        }

        const outcome = await reconcilePaystackReference(reference);
        if (outcome.invoiceId && outcome.invoiceId !== invoice.id) return apiError("Payment reference mismatch", 400);
        if (outcome.result === "MISMATCH" || outcome.result === "NOT_FOUND") return apiError(outcome.reason, 400);
        return apiSuccess({ payment: outcome.result, invoiceId: invoice.id });
    } catch (error) {
        console.error("[Paystack] Callback verification failed:", error instanceof Error ? error.name : "unknown");
        return apiError("Could not verify payment yet. The webhook will retry automatically.", 502);
    }
}
