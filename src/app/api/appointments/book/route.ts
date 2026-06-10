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
        const tenantId = getClinicId();
        const body = await request.json();
        const {
            serviceIds, // Changed from serviceId to serviceIds array
            doctorId,
            date,       // "2026-02-20"
            time,       // "09:00"
            type,       // IN_PERSON | VIRTUAL
            notes,
            // For guest booking
            firstName,
            lastName,
            phone,
            patientId: reqPatientId
        } = body;

        // Try to authenticate, but don't fail immediately if not
        let user = null;
        try {
            const authResult = requireAuth(request);
            if (!("error" in authResult)) {
                user = authResult.user;
            }
        } catch (e) {
            // ignore
        }

        if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0 || !doctorId || !date || !time) {
            return apiError("serviceIds (array), doctorId, date, and time are required", 400);
        }
        const requestedServiceIds = Array.from(
            new Set(serviceIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0))
        );
        if (requestedServiceIds.length === 0) {
            return apiError("serviceIds must contain at least one valid service ID", 400);
        }

        // Verify doctor exists and belongs to tenant
        const doctor = await prisma.user.findFirst({
            where: {
                id: doctorId,
                tenantId,
                status: "ACTIVE",
                roles: { some: { systemRole: "DOCTOR" } }
            }
        });
        if (!doctor) {
            return apiError("Doctor not found or inactive", 404);
        }

        // Determine patient ID
        let finalPatientId: string;
        let isNewPatient = false;

        if (user) {
            if (user.type === "PATIENT") {
                finalPatientId = (user as PatientJWTPayload).patientId;
            } else {
                if (!reqPatientId) return apiError("patientId is required when staff books for a patient", 400);
                finalPatientId = reqPatientId;
            }
            const existingPatient = await prisma.patient.findFirst({
                where: { id: finalPatientId, tenantId }
            });
            if (!existingPatient) {
                return apiError("Patient not found", 404);
            }
        } else {
            // Guest booking -> auto-onboard patient
            if (!firstName || !lastName || !phone) {
                return apiError("firstName, lastName, and phone are required for guest booking. Please log in or provide details.", 401);
            }
            let normalizedPhone = phone.trim();
            if (normalizedPhone.startsWith("0")) normalizedPhone = normalizedPhone.substring(1);
            if (!normalizedPhone.startsWith("+233")) normalizedPhone = `+233${normalizedPhone}`;

            let patient = await prisma.patient.findUnique({
                where: { tenantId_phone: { tenantId, phone: normalizedPhone } }
            });
            if (!patient) {
                patient = await prisma.patient.create({
                    data: { tenantId, phone: normalizedPhone, firstName, lastName }
                });
                isNewPatient = true;
                console.log(`[SMS Simulation] Sent to ${normalizedPhone}: "Welcome to Nexus Dental! Your portal is ready. Login with this phone number to manage your appointments."`);
            }
            finalPatientId = patient.id;
        }

        // Verify services exist and get total duration
        const services: Array<{ id: string; isActive: boolean; duration: number }> = await prisma.service.findMany({
            where: { id: { in: requestedServiceIds }, tenantId },
            select: { id: true, isActive: true, duration: true },
        });

        const activeServices = services.filter((service) => service.isActive);
        if (activeServices.length !== requestedServiceIds.length) {
            return apiError("One or more services not found or inactive", 404);
        }

        const totalDuration = activeServices.reduce((total, service) => total + service.duration, 0);
        const [primaryService, ...additionalServices] = activeServices;

        // Step 1: Acquire slot lock
        const lockId = await acquireSlotLock(tenantId, doctorId, date, time, finalPatientId);
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
            endTime.setMinutes(endTime.getMinutes() + totalDuration);

            const appointment = await prisma.appointment.create({
                data: {
                    tenantId,
                    patientId: finalPatientId,
                    doctorId,
                    serviceId: primaryService.id,
                    additionalServices: {
                        connect: additionalServices.map((service) => ({ id: service.id }))
                    },
                    dateTime,
                    endTime,
                    type: type || "IN_PERSON",
                    status: "SCHEDULED",
                    notes: notes || null,
                    transitions: {
                        create: {
                            fromStatus: "SCHEDULED",
                            toStatus: "SCHEDULED",
                            triggeredBy: (!user || user.type === "PATIENT")
                                ? "PATIENT_SELF"
                                : (user as JWTPayload).userId,
                            reason: "Appointment booked",
                        },
                    },
                },
                include: {
                    patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
                    doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
                    service: { select: { id: true, name: true, price: true, duration: true } },
                    additionalServices: { select: { id: true, name: true, price: true, duration: true } },
                },
            });

            // Step 3: Confirm the slot lock
            await confirmSlotLock(tenantId, doctorId, date, time, lockId);

            // Audit log
            await logAudit({
                tenantId,
                userId: (!user || user.type === "PATIENT")
                    ? null
                    : (user as JWTPayload).userId,
                action: "APPOINTMENT_BOOKED",
                entity: "Appointment",
                entityId: appointment.id,
                newValue: {
                    dateTime: appointment.dateTime,
                    doctorId,
                    serviceIds: requestedServiceIds,
                    status: "SCHEDULED",
                },
                ipAddress: getClientIP(request.headers),
                userAgent: getUserAgent(request.headers),
            });

            // Enqueue reminders
            const msUntil24h = appointment.dateTime.getTime() - Date.now() - 24 * 60 * 60 * 1000;
            const msUntil1h  = appointment.dateTime.getTime() - Date.now() - 60 * 60 * 1000;
            if (msUntil24h > 0) {
                await appointmentQueue.add("reminder", { type: "REMINDER_24H", appointmentId: appointment.id, tenantId }, { delay: msUntil24h }).catch(() => {});
            }
            if (msUntil1h > 0) {
                await appointmentQueue.add("reminder", { type: "REMINDER_1H", appointmentId: appointment.id, tenantId }, { delay: msUntil1h }).catch(() => {});
            }

            return apiSuccess({ appointment, isNewPatient }, 201);
        } catch (bookingError) {
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
