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
import type { JWTPayload } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";
import { refundPayment } from "@/lib/payments/paystack";

// POST /api/invoices/[id]/refund
// Requests a full or partial Paystack refund for a paid invoice.
// Body: { amountGHS?: number; merchantNote?: string; customerNote?: string }
//
// The invoice status is NOT changed here. A refund request is only a request:
// the invoice moves to REFUNDED / PARTIAL_REFUND when Paystack confirms it via
// the `refund.processed` webhook (see /api/webhooks/paystack).
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        // Refunds are a financial-authority action (BILLING_VOID: admins/owners only).
        const permissionError = requirePermission(user, PERMISSIONS.BILLING_VOID);
        if (permissionError) return permissionError;

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return apiError("Invoice not found", 404);

        const tenantError = enforceTenantScope(user, invoice.tenantId);
        if (tenantError) return apiError("Invoice not found", 404);

        if (invoice.status !== "PAID") {
            return apiError("Only paid invoices can be refunded", 400);
        }

        if (!invoice.paystackRef) {
            return apiError(
                "No Paystack reference found. This invoice was paid by cash/card — refund manually.",
                400
            );
        }

        const body = await request.json().catch(() => ({}));
        const { merchantNote, customerNote } = body as {
            merchantNote?: string;
            customerNote?: string;
        };

        let amountGHS: number | undefined;
        if (body.amountGHS !== undefined && body.amountGHS !== null && body.amountGHS !== "") {
            amountGHS = Number(body.amountGHS);
            if (!Number.isFinite(amountGHS) || amountGHS <= 0) {
                return apiError("amountGHS must be a positive number", 400);
            }
            if (amountGHS > invoice.totalAmount) {
                return apiError("Refund amount cannot exceed the invoice total", 400);
            }
        }

        const refund = await refundPayment({
            transactionRef: invoice.paystackRef,
            amountGHS,
            merchantNote,
            customerNote,
        });

        const staffUser = user as JWTPayload;
        await prisma.invoice.update({
            where: { id },
            data: {
                notes: [
                    invoice.notes,
                    `Refund requested by ${staffUser.userId}: ${refund.status} (${amountGHS ?? "full"}) — awaiting provider confirmation`,
                ]
                    .filter(Boolean)
                    .join(" | "),
            },
        });

        await logAudit({
            tenantId: invoice.tenantId,
            userId: staffUser.userId,
            action: "INVOICE_REFUND_REQUESTED",
            entity: "Invoice",
            entityId: id,
            newValue: { amountGHS: amountGHS ?? "full", providerStatus: refund.status },
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        return apiSuccess({ refund, invoiceStatus: invoice.status, pendingConfirmation: true });
    } catch (error: unknown) {
        console.error("[Invoices] Refund error:", error);
        return apiError("Internal server error", 500);
    }
}
