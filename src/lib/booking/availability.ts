// ============================================
// NEXUS DENTAL — Availability Engine
// Calculates open slots with sanitization buffer
// ============================================

import prisma from "@/lib/db/prisma";
import { getLockedSlots } from "./slots";
import { AUTH_CONFIG } from "@/lib/auth/types";

// Default clinic operating hours
const DEFAULT_HOURS = {
    start: 8, // 8:00 AM
    end: 18,  // 6:00 PM
    slotDurationMinutes: 30,
};

export interface TimeSlot {
    time: string;        // "09:00"
    available: boolean;
    locked: boolean;     // Temporarily locked by another patient
}

export interface DaySchedule {
    date: string;        // "2026-02-20"
    dayOfWeek: string;   // "Monday"
    slots: TimeSlot[];
    totalAvailable: number;
}

/**
 * Generate all possible time slots for a day.
 */
function generateTimeSlots(
    startHour: number,
    endHour: number,
    durationMinutes: number
): string[] {
    const slots: string[] = [];
    let currentMinutes = startHour * 60;
    const endMinutes = endHour * 60;

    while (currentMinutes + durationMinutes <= endMinutes) {
        const hours = Math.floor(currentMinutes / 60);
        const mins = currentMinutes % 60;
        slots.push(
            `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
        );
        currentMinutes += durationMinutes;
    }

    return slots;
}

/**
 * Parse a time string "HH:MM" to total minutes since midnight.
 */
function timeToMinutes(time: string): number {
    const [hours, mins] = time.split(":").map(Number);
    return hours * 60 + mins;
}

/**
 * Check if two time slots overlap considering sanitization buffer.
 * A slot is blocked if it falls within [appointment_start - buffer, appointment_end + buffer].
 */
function isSlotBlocked(
    slotTime: string,
    slotDuration: number,
    bookedStart: string,
    bookedDuration: number,
    bufferMinutes: number
): boolean {
    const slotStart = timeToMinutes(slotTime);
    const slotEnd = slotStart + slotDuration;
    const bookedStartMins = timeToMinutes(bookedStart);
    const bookedEnd = bookedStartMins + bookedDuration;

    // Blocked zone: [bookedStart - buffer, bookedEnd + buffer]
    const blockedStart = bookedStartMins - bufferMinutes;
    const blockedEnd = bookedEnd + bufferMinutes;

    // Overlap check
    return slotStart < blockedEnd && slotEnd > blockedStart;
}

/**
 * Get available time slots for a doctor on a specific date.
 *
 * Takes into account:
 * 1. Existing confirmed appointments
 * 2. Redis-locked (in-progress) slots
 * 3. Sanitization buffer (15min default)
 * 4. Past times (for today)
 */
export async function getAvailableSlots(
    tenantId: string,
    doctorId: string,
    date: string,
    serviceDurationMinutes: number = DEFAULT_HOURS.slotDurationMinutes
): Promise<DaySchedule> {
    const dateObj = new Date(date);
    const dayNames = [
        "Sunday", "Monday", "Tuesday", "Wednesday",
        "Thursday", "Friday", "Saturday",
    ];

    // Generate all possible slots
    const allSlotTimes = generateTimeSlots(
        DEFAULT_HOURS.start,
        DEFAULT_HOURS.end,
        DEFAULT_HOURS.slotDurationMinutes
    );

    // Get existing appointments for this doctor on this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await prisma.appointment.findMany({
        where: {
            tenantId,
            doctorId,
            dateTime: {
                gte: startOfDay,
                lte: endOfDay,
            },
            status: {
                in: ["SCHEDULED", "CHECKED_IN", "IN_CHAIR", "IN_IMAGING"],
            },
        },
        select: {
            dateTime: true,
            endTime: true,
        },
    });

    // Get Redis-locked slots
    const lockedSlotTimes = await getLockedSlots(tenantId, doctorId, date);

    // Get current time for filtering past slots (if date is today)
    const now = new Date();
    const isToday = dateObj.toDateString() === now.toDateString();
    const currentMinutes = isToday
        ? now.getHours() * 60 + now.getMinutes()
        : 0;

    // Calculate availability for each slot
    const slots: TimeSlot[] = allSlotTimes.map((time) => {
        const slotMinutes = timeToMinutes(time);

        // Skip past times for today
        if (isToday && slotMinutes <= currentMinutes) {
            return { time, available: false, locked: false };
        }

        // Check if locked in Redis
        if (lockedSlotTimes.includes(time)) {
            return { time, available: false, locked: true };
        }

        // Check against existing appointments with sanitization buffer
        const isBlocked = existingAppointments.some((apt: { dateTime: Date; endTime: Date }) => {
            const aptTime = `${apt.dateTime.getHours().toString().padStart(2, "0")}:${apt.dateTime.getMinutes().toString().padStart(2, "0")}`;
            const aptDuration = Math.round((apt.endTime.getTime() - apt.dateTime.getTime()) / 60000);
            return isSlotBlocked(
                time,
                serviceDurationMinutes,
                aptTime,
                aptDuration,
                AUTH_CONFIG.SANITIZATION_BUFFER_MINUTES
            );
        });

        return { time, available: !isBlocked, locked: false };
    });

    return {
        date,
        dayOfWeek: dayNames[dateObj.getDay()],
        slots,
        totalAvailable: slots.filter((s) => s.available).length,
    };
}

/**
 * Get available slots for a doctor across multiple days.
 */
export async function getWeekAvailability(
    tenantId: string,
    doctorId: string,
    startDate: string,
    days: number = 7,
    serviceDurationMinutes?: number
): Promise<DaySchedule[]> {
    const schedules: DaySchedule[] = [];
    const start = new Date(startDate);

    for (let i = 0; i < days; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);

        // Skip Sundays
        if (date.getDay() === 0) continue;

        const dateStr = date.toISOString().split("T")[0];
        const schedule = await getAvailableSlots(
            tenantId,
            doctorId,
            dateStr,
            serviceDurationMinutes
        );
        schedules.push(schedule);
    }

    return schedules;
}

/**
 * Get all doctors available for a specific service in a tenant.
 */
export async function getAvailableDoctors(
    tenantId: string,
    serviceCategory?: string
) {
    const where: Record<string, unknown> = {
        tenantId,
        role: "DOCTOR",
        status: "ACTIVE",
    };

    if (serviceCategory) {
        where.specialty = serviceCategory;
    }

    const doctors = await prisma.user.findMany({
        where,
        select: {
            id: true,
            firstName: true,
            lastName: true,
            specialty: true,
            avatar: true,
        },
        orderBy: { firstName: "asc" },
    });

    return doctors;
}
