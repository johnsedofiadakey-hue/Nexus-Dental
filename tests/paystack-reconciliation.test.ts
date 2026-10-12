/* eslint-disable @typescript-eslint/no-explicit-any -- deliberately small Prisma-shaped test double */
import { describe, expect, it, vi } from "vitest";
import { reconcilePaystackReference } from "@/lib/payments/reconcile";

const reference = "inv-inv-1-abc12345";

function fixture(over: Record<string, unknown> = {}) {
    const invoice: any = {
        id: "inv-1",
        tenantId: "tenant-a",
        status: "UNPAID",
        totalAmount: 100,
        paystackRef: reference,
        notes: null,
        updatedAt: new Date("2026-10-12T10:00:00Z"),
        ...over,
    };
    const attempt: any = {
        id: "pa-1",
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        reference,
        expectedAmountMinor: 10_000,
        currency: "GHS",
        status: "PENDING",
        refundedAmountMinor: 0,
        invoice,
    };
    const db: any = {
        invoice: {
            findFirst: vi.fn(async ({ where }: any) => where.paystackRef === invoice.paystackRef ? invoice : null),
            update: vi.fn(async ({ data }: any) => Object.assign(invoice, data)),
        },
        paymentAttempt: {
            findUnique: vi.fn(async ({ where }: any) => {
                if (where.reference && where.reference !== attempt.reference) return null;
                if (where.id && where.id !== attempt.id) return null;
                return attempt;
            }),
            create: vi.fn(async ({ data }: any) => Object.assign(attempt, data, { invoice })),
            update: vi.fn(async ({ data }: any) => Object.assign(attempt, data)),
            updateMany: vi.fn(async ({ data }: any) => { Object.assign(attempt, data); return { count: 1 }; }),
        },
    };
    db.$transaction = vi.fn(async (cb: any) => cb(db));
    return { db, invoice, attempt };
}

function transaction(over: Record<string, unknown> = {}) {
    return {
        id: 987654321,
        status: "success",
        reference,
        amount: 10_000,
        currency: "GHS",
        paid_at: "2026-10-12T10:30:00Z",
        channel: "mobile_money",
        metadata: { invoiceId: "inv-1", tenantId: "tenant-a", patientId: "patient-1" },
        customer: { email: "patient@example.test" },
        ...over,
    } as any;
}

describe("Paystack reconciliation", () => {
    it("marks one matching attempt and invoice paid using exact minor units", async () => {
        const { db, invoice, attempt } = fixture();
        const outcome = await reconcilePaystackReference(reference, { db, verify: vi.fn(async () => transaction()) });
        expect(outcome).toEqual({ result: "PAID", invoiceId: "inv-1" });
        expect(invoice).toMatchObject({ status: "PAID", paymentMethod: "PAYSTACK", paystackRef: reference });
        expect(attempt).toMatchObject({ status: "SUCCEEDED", providerTransactionId: "987654321", channel: "mobile_money" });
    });

    it.each([
        ["amount", { amount: 9_999 }],
        ["currency", { currency: "USD" }],
        ["reference", { reference: "different-reference" }],
        ["invoice metadata", { metadata: { invoiceId: "inv-other", tenantId: "tenant-a" } }],
        ["tenant metadata", { metadata: { invoiceId: "inv-1", tenantId: "tenant-b" } }],
    ])("refuses a %s mismatch without marking the invoice paid", async (_name, change) => {
        const { db, invoice } = fixture();
        const outcome = await reconcilePaystackReference(reference, { db, verify: vi.fn(async () => transaction(change)) });
        expect(outcome.result).toBe("MISMATCH");
        expect(invoice.status).toBe("UNPAID");
    });

    it("is idempotent when Paystack retries the same successful webhook", async () => {
        const { db, attempt } = fixture({ status: "PAID" });
        attempt.status = "SUCCEEDED";
        const outcome = await reconcilePaystackReference(reference, { db, verify: vi.fn(async () => transaction()) });
        expect(outcome).toEqual({ result: "ALREADY_PAID", invoiceId: "inv-1" });
    });

    it("records a second genuine payment as a duplicate requiring review", async () => {
        const { db, invoice } = fixture({ status: "PAID", paystackRef: "older-reference" });
        const outcome = await reconcilePaystackReference(reference, { db, verify: vi.fn(async () => transaction()) });
        expect(outcome).toEqual({ result: "DUPLICATE_PAYMENT", invoiceId: "inv-1" });
        expect(invoice.notes).toMatch(/Additional Paystack payment/);
        expect(invoice.paystackRef).toBe("older-reference");
    });

    it("rejects malformed references before contacting Paystack", async () => {
        const verify = vi.fn();
        expect((await reconcilePaystackReference("../bad?key=x", { db: fixture().db, verify })).result).toBe("NOT_FOUND");
        expect(verify).not.toHaveBeenCalled();
    });
});
