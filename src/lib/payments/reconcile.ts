import prisma from "@/lib/db/prisma";
import { verifyPayment, type PaystackVerifyResponse } from "./paystack";
import type { Prisma } from "@prisma/client";

type Db = typeof prisma;

export type PaystackReconcileOutcome =
    | { result: "PAID" | "ALREADY_PAID"; invoiceId: string }
    | { result: "DUPLICATE_PAYMENT"; invoiceId: string }
    | { result: "NOT_FOUND" | "NOT_SUCCESSFUL" | "MISMATCH"; invoiceId?: string; reason: string };

function paidAt(txn: PaystackVerifyResponse): Date {
    const value = new Date(txn.paid_at);
    if (!txn.paid_at || Number.isNaN(value.getTime())) throw new Error("Paystack returned an invalid paid_at timestamp");
    return value;
}

function metadataMatches(txn: PaystackVerifyResponse, invoiceId: string, tenantId: string): boolean {
    const metadata = txn.metadata;
    return Boolean(metadata && metadata.invoiceId === invoiceId && metadata.tenantId === tenantId);
}

/**
 * Server-side source of truth for both the webhook and the authenticated callback.
 * No caller may mark an invoice paid merely because the browser supplied a reference.
 */
export async function reconcilePaystackReference(
    reference: string,
    deps: { db?: Db; verify?: typeof verifyPayment } = {}
): Promise<PaystackReconcileOutcome> {
    if (!reference || reference.length > 160 || !/^[A-Za-z0-9._-]+$/.test(reference)) {
        return { result: "NOT_FOUND", reason: "Invalid payment reference" };
    }

    const db = deps.db ?? prisma;
    const verify = deps.verify ?? verifyPayment;
    const txn = await verify(reference);
    if (txn.status !== "success") return { result: "NOT_SUCCESSFUL", reason: "Transaction is not successful" };
    if (txn.reference !== reference) return { result: "MISMATCH", reason: "Provider reference mismatch" };

    let attempt = await db.paymentAttempt.findUnique({
        where: { reference },
        include: { invoice: true },
    });

    // Backward compatibility for a checkout initialized before payment_attempts existed.
    if (!attempt) {
        const legacyInvoice = await db.invoice.findFirst({ where: { paystackRef: reference } });
        if (!legacyInvoice) return { result: "NOT_FOUND", reason: "No invoice for this payment reference" };
        attempt = await db.paymentAttempt.create({
            data: {
                tenantId: legacyInvoice.tenantId,
                invoiceId: legacyInvoice.id,
                reference,
                expectedAmountMinor: Math.round(legacyInvoice.totalAmount * 100),
                currency: "GHS",
                status: "PENDING",
                initializedAt: legacyInvoice.updatedAt,
            },
            include: { invoice: true },
        });
    }

    const invoice = attempt.invoice;
    const amountMatches = Number.isInteger(txn.amount) && txn.amount === attempt.expectedAmountMinor;
    if (!amountMatches || txn.currency !== attempt.currency || !metadataMatches(txn, invoice.id, invoice.tenantId)) {
        await db.paymentAttempt.updateMany({
            where: { id: attempt.id, status: { not: "SUCCEEDED" } },
            data: { status: "FAILED", failedAt: new Date(), failureReason: "Verified transaction did not match the expected invoice, amount, currency, or metadata." },
        });
        return { result: "MISMATCH", invoiceId: invoice.id, reason: "Payment does not match this invoice" };
    }

    const transactionId = String(txn.id);
    const settledAt = paidAt(txn);

    return db.$transaction(async (tx: Prisma.TransactionClient) => {
        const current = await tx.paymentAttempt.findUnique({ where: { id: attempt.id }, include: { invoice: true } });
        if (!current) return { result: "NOT_FOUND", reason: "Payment attempt disappeared" } as const;

        if (current.status !== "SUCCEEDED") {
            await tx.paymentAttempt.update({
                where: { id: current.id },
                data: {
                    status: "SUCCEEDED",
                    providerTransactionId: transactionId,
                    channel: txn.channel?.slice(0, 40) || null,
                    paidAt: settledAt,
                    failedAt: null,
                    failureReason: null,
                },
            });
        }

        if (current.invoice.status === "PAID") {
            if (current.invoice.paystackRef === reference) {
                return { result: "ALREADY_PAID", invoiceId: current.invoice.id } as const;
            }
            const warning = `Additional Paystack payment ${reference} received after this invoice was already paid; review and refund if appropriate.`;
            await tx.invoice.update({
                where: { id: current.invoice.id },
                data: { notes: [current.invoice.notes, warning].filter(Boolean).join("\n") },
            });
            return { result: "DUPLICATE_PAYMENT", invoiceId: current.invoice.id } as const;
        }

        await tx.invoice.update({
            where: { id: current.invoice.id },
            data: {
                status: "PAID",
                paidAt: settledAt,
                paymentMethod: "PAYSTACK",
                paystackRef: reference,
            },
        });
        return { result: "PAID", invoiceId: current.invoice.id } as const;
    });
}
