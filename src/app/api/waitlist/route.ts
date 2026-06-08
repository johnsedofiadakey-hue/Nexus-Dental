import { NextRequest } from "next/server";
import { requireAuth, isStaffUser, apiError, apiSuccess } from "@/lib/auth";
import type { JWTPayload } from "@/lib/auth";
import prisma from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;
    if (!isStaffUser(user)) return apiError("Staff access required", 403);

    const staffUser = user as JWTPayload;
    const tenantId = staffUser.tenantId;
    if (!tenantId) return apiError("No tenant", 400);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const [entries, total] = await Promise.all([
      prisma.waitlist.findMany({
        where: { tenantId },
        include: {
          patient: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
        },
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.waitlist.count({ where: { tenantId } })
    ]);

    // Also fetch services for the entries that have serviceId
    const serviceIds = entries
      .map((e: any) => e.serviceId)
      .filter(Boolean) as string[];
    const services =
      serviceIds.length > 0
        ? await prisma.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, name: true },
          })
        : [];
    const serviceMap = Object.fromEntries(services.map((s: any) => [s.id, s]));

    const result = entries.map((e: any) => ({
      ...e,
      service: e.serviceId ? serviceMap[e.serviceId] || null : null,
    }));

    return apiSuccess({
      data: result,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("[Waitlist API] GET Error:", error);
    return apiError("Failed to fetch waitlist", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;
    if (!isStaffUser(user)) return apiError("Staff access required", 403);

    const staffUser = user as JWTPayload;
    const tenantId = staffUser.tenantId;
    if (!tenantId) return apiError("No tenant", 400);

    const body = await request.json();
    const { patientId, serviceId, doctorId, preferredDates, notes } = body;

    if (!patientId) return apiError("patientId is required", 400);

    const entry = await prisma.waitlist.create({
      data: {
        tenantId,
        patientId,
        serviceId: serviceId || null,
        doctorId: doctorId || null,
        preferredDates: preferredDates || [],
        notes: notes || null,
      },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });

    return apiSuccess(entry, 201);
  } catch (error) {
    console.error("[Waitlist API] POST Error:", error);
    return apiError("Failed to add to waitlist", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;
    if (!isStaffUser(user)) return apiError("Staff access required", 403);

    const staffUser = user as JWTPayload;
    const tenantId = staffUser.tenantId;
    if (!tenantId) return apiError("No tenant", 400);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return apiError("id query param required", 400);

    await prisma.waitlist.deleteMany({ where: { id, tenantId } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("[Waitlist API] DELETE Error:", error);
    return apiError("Failed to delete waitlist entry", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;
    if (!isStaffUser(user)) return apiError("Staff access required", 403);

    const staffUser = user as JWTPayload;
    const tenantId = staffUser.tenantId;
    if (!tenantId) return apiError("No tenant", 400);

    const body = await request.json();
    const { id, action } = body; // action: "notify" | "book"
    if (!id || !action) return apiError("id and action are required", 400);

    const data: Record<string, unknown> = {};
    if (action === "notify") data.notifiedAt = new Date();
    else if (action === "book") data.bookedAt = new Date();
    else return apiError("action must be 'notify' or 'book'", 400);

    const updated = await prisma.waitlist.updateMany({
      where: { id, tenantId },
      data,
    });

    return apiSuccess({ updated: updated.count });
  } catch (error) {
    console.error("[Waitlist API] PATCH Error:", error);
    return apiError("Failed to update waitlist entry", 500);
  }
}
