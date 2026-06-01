// ─────────────────────────────────────────────────────────────
// Nexus Dental — Paystack Service Layer
// Env vars required:
//   PAYSTACK_SECRET_KEY   — your Paystack secret key (sk_live_... or sk_test_...)
//   NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY — for client-side inline checkout
//   PAYSTACK_WEBHOOK_SECRET — optional, used to verify webhook signatures
// ─────────────────────────────────────────────────────────────

import crypto from "crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

function paystackHeaders() {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
    return {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
    };
}

// ─── Types ───────────────────────────────────────────────────

export interface PaystackInitResponse {
    authorization_url: string;
    access_code: string;
    reference: string;
}

export interface PaystackVerifyResponse {
    status: "success" | "failed" | "abandoned" | "reversed";
    reference: string;
    amount: number;        // in kobo/pesewas (smallest currency unit)
    currency: string;
    paid_at: string;
    metadata?: Record<string, unknown>;
    customer: { email: string };
}

export interface PaystackRefundResponse {
    transaction: string;
    dispute: string | null;
    status: "pending" | "processed" | "failed";
    refunded_at: string | null;
    refunded_by: string;
    customer_note: string;
    merchant_note: string;
    deducted_amount: number;
    fully_deducted: boolean;
}

// ─── Initialize a Payment ─────────────────────────────────────

/**
 * Create a Paystack transaction for an invoice.
 * Returns a hosted checkout URL to redirect the patient/staff to.
 *
 * @param params.email      Payer's email (required by Paystack)
 * @param params.amountGHS  Amount in Ghana Cedis — we convert to pesewas (×100)
 * @param params.reference  Unique reference — use invoice ID or a UUID
 * @param params.callbackUrl Where Paystack redirects after payment
 * @param params.metadata   Any extra data (invoiceId, tenantId, patientId)
 */
export async function initializePayment(params: {
    email: string;
    amountGHS: number;
    reference: string;
    callbackUrl: string;
    metadata?: Record<string, unknown>;
}): Promise<PaystackInitResponse> {
    const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
        method: "POST",
        headers: paystackHeaders(),
        body: JSON.stringify({
            email: params.email,
            amount: Math.round(params.amountGHS * 100), // GHS → pesewas
            currency: "GHS",
            reference: params.reference,
            callback_url: params.callbackUrl,
            metadata: params.metadata ?? {},
        }),
    });

    const json = await res.json();
    if (!res.ok || !json.status) {
        throw new Error(json.message || "Paystack initialization failed");
    }

    return json.data as PaystackInitResponse;
}

// ─── Verify a Payment ─────────────────────────────────────────

/**
 * Verify a Paystack transaction by reference.
 * Call this after the callback redirect OR inside the webhook handler.
 */
export async function verifyPayment(reference: string): Promise<PaystackVerifyResponse> {
    const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: paystackHeaders(),
    });

    const json = await res.json();
    if (!res.ok || !json.status) {
        throw new Error(json.message || "Paystack verification failed");
    }

    return json.data as PaystackVerifyResponse;
}

// ─── Refund a Payment ─────────────────────────────────────────

/**
 * Issue a full or partial refund for a completed transaction.
 *
 * @param params.transactionRef  The Paystack transaction reference
 * @param params.amountGHS       Amount to refund in GHS. Omit for full refund.
 * @param params.merchantNote    Internal note (not shown to customer)
 * @param params.customerNote    Note shown to customer
 */
export async function refundPayment(params: {
    transactionRef: string;
    amountGHS?: number;
    merchantNote?: string;
    customerNote?: string;
}): Promise<PaystackRefundResponse> {
    const body: Record<string, unknown> = {
        transaction: params.transactionRef,
        merchant_note: params.merchantNote ?? "Refund issued by clinic",
        customer_note: params.customerNote ?? "Your payment has been refunded",
    };

    if (params.amountGHS !== undefined) {
        body.amount = Math.round(params.amountGHS * 100);
    }

    const res = await fetch(`${PAYSTACK_BASE}/refund`, {
        method: "POST",
        headers: paystackHeaders(),
        body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok || !json.status) {
        throw new Error(json.message || "Paystack refund failed");
    }

    return json.data as PaystackRefundResponse;
}

// ─── Webhook Signature Verification ──────────────────────────

/**
 * Verify that a webhook request genuinely came from Paystack.
 * Paystack signs the raw body with your secret key using HMAC-SHA512.
 *
 * Usage:
 *   const raw = await request.text();
 *   const sig = request.headers.get("x-paystack-signature");
 *   if (!verifyWebhookSignature(raw, sig)) return 401;
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret || !signature) return false;
    const expected = crypto
        .createHmac("sha512", secret)
        .update(rawBody)
        .digest("hex");
    return expected === signature;
}
