import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { verifyWebhookSignature } from "@/lib/payments/paystack";
import { reconcilePaystackReference } from "@/lib/payments/reconcile";

// POST /api/webhooks/paystack
// Paystack sends events here. Configure this URL in your Paystack dashboard:
//   Settings → API Keys & Webhooks → Webhook URL
//
// Events handled:
//   charge.success   → mark invoice PAID
//   refund.processed → mark invoice REFUNDED / PARTIAL_REFUND
export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const signature = request.headers.get("x-paystack-signature");

    if (!verifyWebhookSignature(rawBody, signature)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let event: { event: string; data: Record<string, unknown> };
    try {
        event = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
        if (event.event === "charge.success") {
            await handleChargeSuccess(event.data);
        } else if (event.event === "refund.processed") {
            await handleRefundProcessed(event.data);
        }
        // Other events (transfer.success, etc.) — ignore for now, return 200
        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[Paystack Webhook] Handler error:", error);
        // Return a real failure so Paystack actually retries — a 200 here would
        // tell Paystack the webhook succeeded and it would never retry, silently
        // leaving the invoice unpaid.
        return NextResponse.json({ received: false, error: "Handler error, check logs" }, { status: 500 });
    }
}

async function handleChargeSuccess(data: Record<string, unknown>) {
    const reference = data.reference as string;
    if (!reference) return;
    const outcome = await reconcilePaystackReference(reference);
    if (outcome.result === "MISMATCH" || outcome.result === "DUPLICATE_PAYMENT") {
        console.error(`[Paystack Webhook] ${outcome.result} for invoice ${outcome.invoiceId ?? "unknown"}; manual review required.`);
    }
}

async function handleRefundProcessed(data: Record<string, unknown>) {
    const transactionRef = (data.transaction as Record<string, unknown>)?.reference as string;
    if (!transactionRef) return;

    const attempt = await prisma.paymentAttempt.findUnique({
        where: { reference: transactionRef },
        include: { invoice: true },
    });

    const invoice = attempt?.invoice ?? await prisma.invoice.findFirst({ where: { paystackRef: transactionRef } });
    if (!invoice || invoice.status !== "PAID") return;

    const fullyDeducted = data.fully_deducted as boolean;
    const deducted = Number(data.deducted_amount ?? 0);
    await prisma.$transaction([
        prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: fullyDeducted ? "REFUNDED" : "PARTIAL_REFUND" },
        }),
        ...(attempt ? [prisma.paymentAttempt.update({
            where: { id: attempt.id },
            data: {
                status: fullyDeducted ? "REFUNDED" : "PARTIALLY_REFUNDED",
                refundedAmountMinor: Number.isSafeInteger(deducted) && deducted >= 0 ? deducted : attempt.refundedAmountMinor,
            },
        })] : []),
    ]);

    console.log(`[Paystack Webhook] Invoice ${invoice.id} → ${fullyDeducted ? "REFUNDED" : "PARTIAL_REFUND"}`);
}
