// ============================================
// NEXUS DENTAL — Book Appointment API
// POST /api/appointments/book
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { getClinicId } from "@/lib/clinic";
import { acquireSlotLock, confirmSlotLock } from "@/lib/booking";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";
import { appointmentQueue } from "@/lib/queue/queues";
import type { PatientJWTPayload, JWTPayload } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        // Authenticate
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const tenantId = getClinicId();
        const body = await request.json();
        const {
            serviceId,
            doctorId,
            date,       // "2026-02-20"
            time,       // "09:00"
            type,       // IN_PERSON | VIRTUAL
            notes,
        } = body;

        // Validate required fields
        if (!serviceId || !doctorId || !date || !time) {
            return apiError("serviceId, doctorId, date, and time are required", 400);
        }

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
                                ? "PATIENT_SELF"
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

            // Audit log — pass null userId for patient-initiated bookings (no User FK)
            await logAudit({
                tenantId,
                userId: user.type === "PATIENT"
                    ? null
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

            // Enqueue 24h and 1h reminder jobs
            const msUntil24h = appointment.dateTime.getTime() - Date.now() - 24 * 60 * 60 * 1000;
            const msUntil1h  = appointment.dateTime.getTime() - Date.now() - 60 * 60 * 1000;
            if (msUntil24h > 0) {
                await appointmentQueue.add("reminder", { type: "REMINDER_24H", appointmentId: appointment.id, tenantId }, { delay: msUntil24h }).catch(() => {});
            }
            if (msUntil1h > 0) {
                await appointmentQueue.add("reminder", { type: "REMINDER_1H", appointmentId: appointment.id, tenantId }, { delay: msUntil1h }).catch(() => {});
            }

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
