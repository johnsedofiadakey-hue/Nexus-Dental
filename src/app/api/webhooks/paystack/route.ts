import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { verifyWebhookSignature, verifyPayment } from "@/lib/payments/paystack";

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
        // Return 200 anyway — Paystack will retry on 4xx/5xx
        return NextResponse.json({ received: true, warning: "Handler error, check logs" });
    }
}

async function handleChargeSuccess(data: Record<string, unknown>) {
    const reference = data.reference as string;
    if (!reference) return;

    // Verify with Paystack directly (don't trust webhook payload alone)
    const txn = await verifyPayment(reference);
    if (txn.status !== "success") return;

    const invoice = await prisma.invoice.findFirst({
        where: { paystackRef: reference },
    });

    if (!invoice) {
        console.warn(`[Paystack Webhook] No invoice found for ref: ${reference}`);
        return;
    }

    if (invoice.status === "PAID") return; // idempotent — already marked

    await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
            status: "PAID",
            paidAt: new Date(txn.paid_at),
            paymentMethod: "PAYSTACK",
            paystackRef: reference,
        },
    });

    console.log(`[Paystack Webhook] Invoice ${invoice.id} marked PAID via ref ${reference}`);
}

async function handleRefundProcessed(data: Record<string, unknown>) {
    const transactionRef = (data.transaction as Record<string, unknown>)?.reference as string;
    if (!transactionRef) return;

    const invoice = await prisma.invoice.findFirst({
        where: { paystackRef: transactionRef },
    });

    if (!invoice || invoice.status !== "PAID") return;

    const fullyDeducted = data.fully_deducted as boolean;
    await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: fullyDeducted ? "REFUNDED" : "PARTIAL_REFUND" },
    });

    console.log(`[Paystack Webhook] Invoice ${invoice.id} → ${fullyDeducted ? "REFUNDED" : "PARTIAL_REFUND"}`);
}
