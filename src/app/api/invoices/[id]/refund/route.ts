import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { refundPayment } from "@/lib/payments/paystack";

// POST /api/invoices/[id]/refund
// Issues a full or partial Paystack refund for a paid invoice.
// Body: { amountGHS?: number; merchantNote?: string; customerNote?: string }
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return apiError("Invoice not found", 404);

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
        const { amountGHS, merchantNote, customerNote } = body;

        const refund = await refundPayment({
            transactionRef: invoice.paystackRef,
            amountGHS: amountGHS ? parseFloat(amountGHS) : undefined,
            merchantNote,
            customerNote,
        });

        // Mark invoice as refunded
        const isFullRefund = !amountGHS || parseFloat(amountGHS) >= invoice.totalAmount;
        await prisma.invoice.update({
            where: { id },
            data: {
                status: isFullRefund ? "REFUNDED" : "PARTIAL_REFUND",
                notes: [invoice.notes, `Refund: ${refund.status} (${amountGHS ?? "full"})`]
                    .filter(Boolean)
                    .join(" | "),
            },
        });

        return apiSuccess({ refund, invoiceStatus: isFullRefund ? "REFUNDED" : "PARTIAL_REFUND" });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Internal server error";
        return apiError(msg, 500);
    }
}
