// ============================================
// NEXUS DENTAL — Hubtel Payment Service
// ============================================

export type PaymentMethod = "momo-mtn" | "momo-vodafone" | "momo-airteltigo" | "card";

interface PaymentRequest {
    amount: number;
    title: string;
    description: string;
    clientReference: string;
    customerPhone: string;
    callbackUrl: string;
}

interface PaymentResponse {
    success: boolean;
    checkoutUrl?: string;
    transactionId?: string;
    error?: string;
}

/**
 * Initiates a Hubtel Checkout session.
 * 
 * If Hubtel API credentials are not found in the environment, it activates
 * "Demo Mode" and simulates a successful transaction after a brief delay.
 */
export async function initiateHubtelCheckout(req: PaymentRequest): Promise<PaymentResponse> {
    const clientId = process.env.HUBTEL_CLIENT_ID;
    const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
    const merchantAccountNumber = process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER;

    // DEMO MODE
    if (!clientId || !clientSecret || !merchantAccountNumber) {
        console.log("[Hubtel Payment Dev] Simulating transaction...");
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return {
            success: true,
            transactionId: `DEMO-TXN-${Date.now()}`,
        };
    }

    // PRODUCTION MODE
    try {
        const auth = "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
        
        const res = await fetch("https://payproxyapi.hubtel.com/items/tcpise/checkout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: auth,
            },
            body: JSON.stringify({
                amount: req.amount,
                title: req.title,
                description: req.description,
                clientReference: req.clientReference,
                callbackUrl: req.callbackUrl,
                returnUrl: req.callbackUrl,
                cancellationUrl: req.callbackUrl,
                merchantAccountNumber: merchantAccountNumber,
                branchName: "Nexus Dental",
            }),
        });

        const data = await res.json();
        if (data.status === "Success" && data.data?.checkoutUrl) {
            return {
                success: true,
                checkoutUrl: data.data.checkoutUrl,
                transactionId: data.data.checkoutId,
            };
        }

        return { success: false, error: data.message || "Failed to initialize checkout." };
    } catch (error) {
        console.error("[Hubtel Payment Error]", error);
        return { success: false, error: "Network error during checkout initialization." };
    }
}
