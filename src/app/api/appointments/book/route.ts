// ============================================
// NEXUS DENTAL — Book Appointment API
// POST /api/appointments/book
//
// Response data: { appointment, isNewPatient, remindersScheduled }
//   remindersScheduled = {
//     enabled,            // the clinic switch AND an SMS provider both allow reminders
//     reason?,            // why not, when enabled is false
//     timeZone,           // the clinic zone the appointment time was interpreted in
//     complete,           // true only if every reminder that should exist is recorded AND queued
//     items: [{ offsetMinutes: 60 | 30, scheduledFor: ISO, status: PENDING | NOT_QUEUED | SKIPPED_PAST | FAILED }]
//   }
// The reminders are written in the SAME transaction as the appointment. If the queue is
// unavailable the booking still succeeds, the summary says NOT_QUEUED, and the worker's
// reconciler queues them from the database as soon as it can.
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, requirePermission, PERMISSIONS, apiError, apiSuccess } from "@/lib/auth";
import { getClinicId } from "@/lib/clinic";
import { acquireSlotLock, confirmSlotLock } from "@/lib/booking";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";
import { appointmentQueue } from "@/lib/queue/queues";
import { sendSms } from "@/lib/sms";
import { maskPhone, normalizePhone, phoneLookupVariants } from "@/lib/phone";
import { clinicTimeZone, zonedWallTimeToUtc } from "@/lib/utils/timezone";
import { reminderCreateData, enqueueAndSummarise, remindersDisabledSummary } from "@/lib/reminders/schedule";
import { smsRemindersState } from "@/lib/reminders/settings";
import type { PatientJWTPayload, JWTPayload } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const tenantId = getClinicId();
        const body = await request.json();
        const {
            serviceIds, // Changed from serviceId to serviceIds array
            doctorId,
            date,       // "2026-02-20" — a calendar date in the CLINIC's time zone
            time,       // "09:00"      — wall-clock time in the CLINIC's time zone
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
            const authResult = await requireAuth(request);
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

        // The clinic's zone decides what "09:00" means. Never the host machine's.
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, timezone: true } });
        const timeZone = clinicTimeZone(tenant?.timezone);
        const dateTime = typeof date === "string" && typeof time === "string" ? zonedWallTimeToUtc(date, time, timeZone) : null;
        if (!dateTime) {
            return apiError("date must be YYYY-MM-DD and time must be HH:mm", 400);
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
        let welcomeTo: string | null = null;

        if (user && user.type === "PATIENT") {
            finalPatientId = (user as PatientJWTPayload).patientId;
            const existingPatient = await prisma.patient.findFirst({
                where: { id: finalPatientId, tenantId }
            });
            if (!existingPatient) {
                return apiError("Patient not found", 404);
            }
        } else if (user && reqPatientId) {
            // Staff booking for a specific, already-identified patient (e.g. from Patient 360).
            // This path uses exactly that patient: there is no second phone-based find/create.
            const permissionError = requirePermission(user, PERMISSIONS.APPOINTMENTS_CREATE);
            if (permissionError) return permissionError;
            if (typeof reqPatientId !== "string") {
                return apiError("patientId must be a string", 400);
            }
            finalPatientId = reqPatientId;
            const existingPatient = await prisma.patient.findFirst({
                where: { id: finalPatientId, tenantId, deletedAt: null }
            });
            if (!existingPatient) {
                return apiError("Patient not found", 404);
            }
        } else {
            // Guest booking, or staff booking a walk-in/returning patient by name & phone -> find or create
            if (!firstName || !lastName || !phone) {
                return apiError("firstName, lastName, and phone are required when no patientId is provided.", 400);
            }
            const normalized = normalizePhone(phone);
            if (!normalized.ok) {
                return apiError("Please enter a valid phone number.", 400);
            }

            // Older records may have been stored as +233…, 0… or bare 24…: look under every spelling so
            // "024…" and "+23324…" can never become two patients. More than one match is ambiguous and is
            // NOT silently merged.
            const matches: Array<{ id: string }> = await prisma.patient.findMany({
                where: { tenantId, deletedAt: null, phone: { in: phoneLookupVariants(phone) } },
                select: { id: true },
                take: 2,
            });
            if (matches.length > 1) {
                await logAudit({
                    tenantId, userId: null, action: "BOOKING_PHONE_AMBIGUOUS", entity: "Patient", entityId: "multiple",
                    newValue: { phone: maskPhone(normalized.e164) },
                    ipAddress: getClientIP(request.headers), userAgent: getUserAgent(request.headers),
                });
                return apiError("More than one patient record matches this phone number. Please contact the clinic to book.", 409);
            }
            if (matches.length === 1) {
                finalPatientId = matches[0].id;
            } else {
                const created = await prisma.patient.create({
                    data: { tenantId, phone: normalized.e164, firstName, lastName }
                });
                finalPatientId = created.id;
                isNewPatient = true;
                welcomeTo = normalized.e164;
            }
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
            // Step 2: Create the appointment (and its reminder rows, atomically)
            const endTime = new Date(dateTime.getTime() + totalDuration * 60_000);

            const reminderState = await smsRemindersState(tenantId);
            const now = new Date();

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
                    ...(reminderState.enabled ? { reminders: { create: reminderCreateData(tenantId, dateTime, now) } } : {}),
                },
                include: {
                    patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
                    doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
                    service: { select: { id: true, name: true, price: true, duration: true } },
                    additionalServices: { select: { id: true, name: true, price: true, duration: true } },
                    reminders: true,
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

            // Queue the reminders. Failure is REPORTED, never swallowed: the durable rows exist and
            // the worker's reconciler will queue them, but the caller is told they are not queued yet.
            const remindersScheduled = reminderState.enabled
                ? await enqueueAndSummarise({
                    rows: appointment.reminders,
                    appointmentAt: dateTime,
                    queue: appointmentQueue,
                    timeZone,
                    now,
                    onQueueError: (error) => console.error("[Booking] Could not queue a reminder job:", error instanceof Error ? error.message : "unknown"),
                })
                : remindersDisabledSummary(reminderState.reason, timeZone);
            if (!remindersScheduled.complete) {
                await logAudit({
                    tenantId, userId: null, action: "APPOINTMENT_REMINDERS_INCOMPLETE", entity: "Appointment", entityId: appointment.id,
                    newValue: { items: remindersScheduled.items },
                });
            }

            // Welcome SMS for a brand-new patient: best effort, through the provider-neutral service.
            // (In demo mode a number that is not on the allowlist is refused there, by design.)
            if (welcomeTo) {
                await sendSms(
                    welcomeTo,
                    `Welcome to ${tenant?.name ?? "our clinic"}! Your patient portal is ready: sign in with this phone number to see your appointments.`
                ).catch((err) => console.error("[Booking] Welcome SMS not sent:", err instanceof Error ? err.message : "unknown"));
            }

            const { reminders: _reminders, ...appointmentOut } = appointment;
            void _reminders;
            return apiSuccess({ appointment: appointmentOut, isNewPatient, remindersScheduled }, 201);
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
