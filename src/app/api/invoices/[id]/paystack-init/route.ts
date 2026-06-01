import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, enforceTenantScope, apiError, apiSuccess } from "@/lib/auth";
import { initializePayment } from "@/lib/payments/paystack";
import { randomUUID } from "crypto";

// POST /api/invoices/[id]/paystack-init
// Creates a Paystack checkout session for an invoice.
// Returns { authorizationUrl, reference } — redirect the user to authorizationUrl.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, email: true } },
                tenant: { select: { id: true, name: true, email: true } },
            },
        });

        if (!invoice) return apiError("Invoice not found", 404);

        const tenantCheck = enforceTenantScope(user, invoice.tenantId);
        if (tenantCheck) return tenantCheck;

        if (invoice.status === "PAID") {
            return apiError("Invoice is already paid", 400);
        }

        // Use the patient's email if available, fall back to clinic email
        const payerEmail =
            invoice.patient.email ||
            invoice.tenant.email ||
            "payments@nexusdental.app";

        // Generate a stable reference tied to this invoice attempt
        const reference = `inv-${id}-${randomUUID().slice(0, 8)}`;

        const { searchParams } = new URL(request.url);
        const callbackUrl =
            searchParams.get("callbackUrl") ||
            `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/finance/invoices?paid=${id}`;

        const paystack = await initializePayment({
            email: payerEmail,
            amountGHS: invoice.totalAmount,
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

        // Store the pending reference on the invoice so the webhook can match it
        await prisma.invoice.update({
            where: { id },
            data: { paystackRef: reference },
        });

        return apiSuccess({
            authorizationUrl: paystack.authorization_url,
            reference: paystack.reference,
            accessCode: paystack.access_code,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Internal server error";
        return apiError(msg, 500);
    }
}
