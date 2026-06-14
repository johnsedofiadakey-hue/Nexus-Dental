import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import type { JWTPayload } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getTenantIdFromUser } from "@/lib/clinic";

/**
 * GET /api/lab-orders
 * List lab orders for the tenant (filter by status, patientId, search)
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const user = authResult.user as JWTPayload;

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") as string | null;
        const patientId = searchParams.get("patientId");
        const search = searchParams.get("search");

        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");

        const where: any = {
            tenantId: getTenantIdFromUser(user),
            ...(status ? { status: status as any } : {}),
            ...(patientId ? { patientId } : {}),
            ...(search
                ? {
                      OR: [
                          {
                              patient: {
                                  OR: [
                                      { firstName: { contains: search, mode: "insensitive" } },
                                      { lastName: { contains: search, mode: "insensitive" } },
                                  ],
                              },
                          },
                          { labName: { contains: search, mode: "insensitive" } },
                      ],
                  }
                : {}),
        };

        const [labOrders, total] = await Promise.all([
            prisma.labOrder.findMany({
                where,
                include: {
                    patient: { select: { id: true, firstName: true, lastName: true } },
                    doctor: { select: { id: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.labOrder.count({ where })
        ]);

        return apiSuccess({
            data: labOrders,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error: any) {
        console.error("[Lab Orders API] GET Error:", error);
        return apiError(error.message || "Internal Server Error", 500);
    }
}

/**
 * POST /api/lab-orders
 * Create a new lab order
 */
export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const user = authResult.user as JWTPayload;

        const body = await request.json();
        const {
            patientId,
            appointmentId,
            doctorId,
            labName,
            labContact,
            labEmail,
            toothNumbers,
            restoration,
            material,
            shade,
            instructions,
            dueAt,
            cost,
        } = body;

        if (!patientId || !doctorId || !labName || !restoration || !toothNumbers) {
            return apiError("Missing required fields: patientId, doctorId, labName, restoration, toothNumbers", 400);
        }

        const labOrder = await prisma.labOrder.create({
            data: {
                tenantId: getTenantIdFromUser(user),
                patientId,
                appointmentId: appointmentId || null,
                doctorId,
                labName,
                labContact: labContact || null,
                labEmail: labEmail || null,
                toothNumbers: Array.isArray(toothNumbers) ? toothNumbers : [],
                restoration,
                material: material || null,
                shade: shade || null,
                instructions: instructions || null,
                dueAt: dueAt ? new Date(dueAt) : null,
                cost: cost != null ? Number(cost) : null,
            },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true } },
                doctor: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        return apiSuccess(labOrder, 201);
    } catch (error: any) {
        console.error("[Lab Orders API] POST Error:", error);
        return apiError(error.message || "Internal Server Error", 500);
    }
}
