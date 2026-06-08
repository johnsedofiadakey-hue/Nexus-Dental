import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getClinicId } from "@/lib/clinic";
import { initiateHubtelCheckout } from "@/lib/payments/hubtel";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { invoiceId, phone } = body as { invoiceId: string; phone: string };

        if (!invoiceId) {
            return NextResponse.json({ success: false, error: "Invoice ID is required." }, { status: 400 });
        }

        const tenantId = getClinicId();

        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId, tenantId },
            include: { appointment: { include: { patient: true } } }
        });

        if (!invoice) {
            return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
        }

        if (invoice.status === "PAID") {
            return NextResponse.json({ success: false, error: "Invoice is already paid." }, { status: 400 });
        }

        // Call Hubtel
        const paymentResult = await initiateHubtelCheckout({
            amount: invoice.amount,
            title: "Nexus Dental Payment",
            description: `Payment for Invoice #${invoice.id.substring(0, 8).toUpperCase()}`,
            clientReference: invoice.id,
            customerPhone: phone || invoice.appointment?.patient?.phone || "000000000",
            callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://nexusdental.app"}/api/payments/callback`,
        });

        if (!paymentResult.success) {
            return NextResponse.json({ success: false, error: paymentResult.error }, { status: 500 });
        }

        // If Demo Mode (no checkoutUrl, just transactionId)
        if (paymentResult.success && !paymentResult.checkoutUrl) {
            // Update immediately to PAID for demo purposes
            await prisma.invoice.update({
                where: { id: invoice.id },
                data: { status: "PAID", updatedAt: new Date() }
            });
            return NextResponse.json({ success: true, message: "Payment processed successfully (Demo Mode)." });
        }

        // If Production Mode, return the checkout URL
        return NextResponse.json({ 
            success: true, 
            checkoutUrl: paymentResult.checkoutUrl 
        });

    } catch (err) {
        console.error("[payments/post]", err);
        return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
    }
}
