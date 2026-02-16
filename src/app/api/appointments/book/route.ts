// ============================================
// NEXUS DENTAL — Book Appointment API
// POST /api/appointments/book
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, enforceTenantScope, apiError, apiSuccess } from "@/lib/auth";
import { acquireSlotLock, confirmSlotLock } from "@/lib/booking";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";
import type { PatientJWTPayload, JWTPayload } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        // Authenticate
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const body = await request.json();
        const {
            tenantId,
            serviceId,
            doctorId,
            date,       // "2026-02-20"
            time,       // "09:00"
            type,       // IN_PERSON | VIRTUAL
            notes,
        } = body;

        // Validate required fields
        if (!tenantId || !serviceId || !doctorId || !date || !time) {
            return apiError("tenantId, serviceId, doctorId, date, and time are required", 400);
        }

        // Enforce tenant scope
        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        // Determine patient ID
        let patientId: string;
        if (user.type === "PATIENT") {
            patientId = (user as PatientJWTPayload).patientId;
        } else {
            // Staff booking on behalf of patient
            if (!body.patientId) {
                return apiError("patientId is required when staff books for a patient", 400);
            }
            patientId = body.patientId;
        }

        // Verify service exists and get duration
        const service = await prisma.service.findFirst({
            where: { id: serviceId, tenantId },
        });

        if (!service || !service.isActive) {
            return apiError("Service not found or inactive", 404);
        }

        // Step 1: Acquire slot lock
        const lockId = await acquireSlotLock(tenantId, doctorId, date, time, patientId);
        if (!lockId) {
            return apiError(
                "This time slot is currently being booked by another patient. Please choose a different time.",
                409
            );
        }

        try {
            // Step 2: Create the appointment
            const [hours, minutes] = time.split(":").map(Number);
            const dateTime = new Date(date);
            dateTime.setHours(hours, minutes, 0, 0);

            // Calculate end time
            const endTime = new Date(dateTime);
            endTime.setMinutes(endTime.getMinutes() + service.duration);

            const appointment = await prisma.appointment.create({
                data: {
                    tenantId,
                    patientId,
                    doctorId,
                    serviceId,
                    dateTime,
                    endTime,
                    type: type || "IN_PERSON",
                    status: "SCHEDULED",
                    notes: notes || null,
                    transitions: {
                        create: {
                            fromStatus: "SCHEDULED",
                            toStatus: "SCHEDULED",
                            triggeredBy: user.type === "PATIENT"
                                ? (user as PatientJWTPayload).patientId
                                : (user as JWTPayload).userId,
                            reason: "Appointment booked",
                        },
                    },
                },
                include: {
                    patient: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            phone: true,
                        },
                    },
                    doctor: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            specialty: true,
                        },
                    },
                    service: {
                        select: {
                            id: true,
                            name: true,
                            price: true,
                            duration: true,
                        },
                    },
                },
            });

            // Step 3: Confirm the slot lock
            await confirmSlotLock(tenantId, doctorId, date, time, lockId);

            // Audit log
            await logAudit({
                tenantId,
                userId: user.type === "PATIENT"
                    ? (user as PatientJWTPayload).patientId
                    : (user as JWTPayload).userId,
                action: "APPOINTMENT_BOOKED",
                entity: "Appointment",
                entityId: appointment.id,
                newValue: {
                    dateTime: appointment.dateTime,
                    doctorId,
                    serviceId,
                    status: "SCHEDULED",
                },
                ipAddress: getClientIP(request.headers),
                userAgent: getUserAgent(request.headers),
            });

            return apiSuccess(appointment, 201);
        } catch (bookingError) {
            // If booking fails, release the lock
            await import("@/lib/booking").then(({ releaseSlotLock }) =>
                releaseSlotLock(tenantId, doctorId, date, time, lockId)
            );
            throw bookingError;
        }
    } catch (error) {
        console.error("[Booking] Error:", error);
        return apiError("Internal server error", 500);
    }
}
