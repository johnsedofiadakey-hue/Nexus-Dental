import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, requirePermission, isPatientUser, isStaffUser, PERMISSIONS, apiError, apiSuccess } from "@/lib/auth";
import { getTenantIdFromUser } from "@/lib/clinic";
import type { JWTPayload } from "@/lib/auth";
import type { PatientJWTPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const tenantId = getTenantIdFromUser(user);
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const patientId = searchParams.get("patientId");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        const where: Record<string, unknown> = { tenantId };
        if (isPatientUser(user)) {
            where.patientId = (user as PatientJWTPayload).patientId;
        } else {
            const permissionError = requirePermission(user, PERMISSIONS.BILLING_VIEW);
            if (permissionError) return permissionError;
        }
        if (status && status !== "ALL") where.status = status;
        if (patientId && !isPatientUser(user)) where.patientId = patientId;

        const [invoices, total] = await Promise.all([
            prisma.invoice.findMany({
                where,
                include: {
                    patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
                    createdBy: { select: { id: true, firstName: true, lastName: true } },
                    appointment: { select: { id: true, dateTime: true, service: { select: { name: true } }, additionalServices: { select: { name: true } } } },
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

        if (!isStaffUser(user)) return apiError("Staff access required", 403);
        const permissionError = requirePermission(user, PERMISSIONS.BILLING_CREATE);
        if (permissionError) return permissionError;

        const staffUser = user as JWTPayload;
        const body = await request.json();
        const tenantId = getTenantIdFromUser(user);
        const { patientId, appointmentId, items, discount = 0, notes } = body;

        if (!patientId || !appointmentId || !items?.length) {
            return apiError("patientId, appointmentId, and items are required", 400);
        }

        if (typeof patientId !== "string" || typeof appointmentId !== "string") {
            return apiError("patientId and appointmentId must be strings", 400);
        }
        if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
            return apiError("items must be a list of 1 to 100 line items", 400);
        }

        // Every line item must be a real, non-negative charge. Negative or
        // non-numeric values would otherwise silently distort the invoice total.
        for (const item of items) {
            const quantity = Number(item?.quantity);
            const unitPrice = Number(item?.unitPrice);
            if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) {
                return apiError("Each item needs a quantity greater than 0", 400);
            }
            if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 10_000_000) {
                return apiError("Each item needs a unit price of 0 or more", 400);
            }
        }

        const round2 = (n: number) => Math.round(n * 100) / 100;
        const amount = round2(items.reduce((sum: number, item: any) => sum + Number(item.quantity) * Number(item.unitPrice), 0));

        const discountValue = Number(discount);
        if (!Number.isFinite(discountValue) || discountValue < 0) {
            return apiError("discount must be 0 or more", 400);
        }
        if (discountValue > amount) {
            return apiError("discount cannot exceed the invoice amount", 400);
        }
        const totalAmount = round2(amount - discountValue);

        // The patient and appointment must belong to THIS clinic, and the
        // appointment must be for this patient — never trust client-supplied ids.
        const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId }, select: { id: true } });
        if (!patient) return apiError("Patient not found", 404);
        const appointment = await prisma.appointment.findFirst({
            where: { id: appointmentId, tenantId, patientId },
            select: { id: true },
        });
        if (!appointment) return apiError("Appointment not found for this patient", 404);

        const invoice = await prisma.invoice.create({
            data: {
                tenantId,
                patientId,
                appointmentId,
                createdById: staffUser.userId,
                amount,
                discount: discountValue,
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
