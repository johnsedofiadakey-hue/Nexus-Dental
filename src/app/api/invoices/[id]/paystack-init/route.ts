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
import { initializePayment } from "@/lib/payments/paystack";
import { randomUUID } from "crypto";
import { featureDisabledResponse, resolveProviders } from "@/lib/config/features";

// POST /api/invoices/[id]/paystack-init
// Creates a Paystack checkout session for an invoice.
// Returns { authorizationUrl, reference } — redirect the user to authorizationUrl.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authResult = await requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const paystackProvider = resolveProviders().paystack;
        if (!paystackProvider.enabled) return featureDisabledResponse("paystack", paystackProvider.reason);

        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, email: true } },
                tenant: { select: { id: true, name: true, email: true } },
            },
        });

        if (!invoice) return apiError("Invoice not found", 404);

        if (isPatientUser(user)) {
            if (invoice.patientId !== (user as PatientJWTPayload).patientId) {
                return apiError("Invoice not found", 404);
            }
        } else {
            if (invoice.tenantId !== user.tenantId) return apiError("Invoice not found", 404);
            const permissionError = requirePermission(user, PERMISSIONS.BILLING_VIEW);
            if (permissionError) return permissionError;
        }

        if (invoice.status === "PAID") {
            return apiError("Invoice is already paid", 400);
        }
        if (!["UNPAID", "PENDING", "OVERDUE"].includes(invoice.status)) {
            return apiError("This invoice cannot be paid online", 409);
        }
        const amountMinor = Math.round(invoice.totalAmount * 100);
        if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
            return apiError("This invoice has no payable balance", 400);
        }

        // Use the patient's email if available, fall back to clinic email
        const payerEmail = invoice.patient.email || invoice.tenant.email;
        if (!payerEmail) return apiError("Add a patient or clinic email before starting online payment", 400);

        // Reuse a recent pending checkout instead of creating several references when a
        // patient double-taps Pay now. Every provider reference remains durable in
        // payment_attempts, so even an older checkout can still reconcile correctly.
        const recent = await prisma.paymentAttempt.findFirst({
            where: {
                invoiceId: invoice.id,
                status: "PENDING",
                authorizationUrl: { not: null },
                createdAt: { gte: new Date(Date.now() - 30 * 60_000) },
            },
            orderBy: { createdAt: "desc" },
        });
        if (recent?.authorizationUrl) {
            return apiSuccess({ authorizationUrl: recent.authorizationUrl, reference: recent.reference, accessCode: recent.accessCode, reused: true });
        }

        // Generate a stable reference tied to this invoice attempt
        const reference = `inv-${id}-${randomUUID().slice(0, 8)}`;

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
        const callbackPath = isPatientUser(user) ? "/portal/records" : "/finance/invoices";
        const callbackUrl = `${appUrl}${callbackPath}?paid=${encodeURIComponent(id)}`;

        const attempt = await prisma.paymentAttempt.create({
            data: {
                tenantId: invoice.tenantId,
                invoiceId: invoice.id,
                reference,
                expectedAmountMinor: amountMinor,
                currency: "GHS",
                status: "INITIALIZING",
            },
        });

        let paystack;
        try {
            paystack = await initializePayment({
                email: payerEmail,
                amountGHS: amountMinor / 100,
                reference,
                callbackUrl,
                metadata: {
                    invoiceId: invoice.id,
                    tenantId: invoice.tenantId,
                    patientId: invoice.patientId,
                    patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
                    clinicName: invoice.tenant.name,
                },
            });
        } catch {
            await prisma.paymentAttempt.update({
                where: { id: attempt.id },
                data: { status: "FAILED", failedAt: new Date(), failureReason: "Paystack initialization failed." },
            });
            return apiError("Could not start Paystack checkout. Please try again.", 502);
        }

        await prisma.$transaction([
            prisma.paymentAttempt.update({
                where: { id: attempt.id },
                data: {
                    status: "PENDING",
                    authorizationUrl: paystack.authorization_url,
                    accessCode: paystack.access_code,
                    initializedAt: new Date(),
                },
            }),
            // Backwards-compatible pointer only; payment_attempts remains the ledger.
            prisma.invoice.update({ where: { id }, data: { paystackRef: reference } }),
        ]);

        return apiSuccess({
            authorizationUrl: paystack.authorization_url,
            reference: paystack.reference,
            accessCode: paystack.access_code,
            reused: false,
        });
    } catch (error: unknown) {
        console.error("[Paystack] Checkout initialization failed:", error instanceof Error ? error.name : "unknown");
        return apiError("Could not start online payment", 500);
    }
}
