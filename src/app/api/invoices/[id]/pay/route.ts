import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, enforceTenantScope, apiError, apiSuccess } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const body = await request.json();
        const { method = "CASH", paystackRef } = body;

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return apiError("Invoice not found", 404);

        const tenantCheck = enforceTenantScope(user, invoice.tenantId);
        if (tenantCheck) return tenantCheck;

        if (invoice.status === "PAID") return apiError("Invoice already paid", 400);

        const updated = await prisma.invoice.update({
            where: { id },
            data: {
                status: "PAID",
                paidAt: new Date(),
                notes: paystackRef
                    ? `${invoice.notes || ""}\nPaystack ref: ${paystackRef}`.trim()
                    : invoice.notes,
            },
        });

        return apiSuccess(updated);
    } catch (error) {
        console.error("[Invoices] Pay error:", error);
        return apiError("Internal server error", 500);
    }
}
