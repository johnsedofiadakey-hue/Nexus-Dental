import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, requirePermission, PERMISSIONS, apiError, apiSuccess } from "@/lib/auth";
import { getClinicId } from "@/lib/clinic";
import type { JWTPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const tenantId = getClinicId();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const patientId = searchParams.get("patientId");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        const where: Record<string, unknown> = { tenantId };
        if (status && status !== "ALL") where.status = status;
        if (patientId) where.patientId = patientId;

        const [invoices, total] = await Promise.all([
            prisma.invoice.findMany({
                where,
                include: {
                    patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
                    createdBy: { select: { id: true, firstName: true, lastName: true } },
                    appointment: { select: { id: true, dateTime: true, service: { select: { name: true } } } },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.invoice.count({ where }),
        ]);

        return apiSuccess({ invoices, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
        console.error("[Invoices] GET error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const staffUser = user as JWTPayload;
        const body = await request.json();
        const tenantId = getClinicId();
        const { patientId, appointmentId, items, discount = 0, notes } = body;

        if (!patientId || !appointmentId || !items?.length) {
            return apiError("patientId, appointmentId, and items are required", 400);
        }

        const amount = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0);
        const totalAmount = Math.max(0, amount - discount);

        const invoice = await prisma.invoice.create({
            data: {
                tenantId,
                patientId,
                appointmentId,
                createdById: staffUser.userId,
                amount,
                discount,
                totalAmount,
                status: "UNPAID",
                items,
                notes: notes || null,
            },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        return apiSuccess(invoice, 201);
    } catch (error) {
        console.error("[Invoices] POST error:", error);
        return apiError("Internal server error", 500);
    }
}
