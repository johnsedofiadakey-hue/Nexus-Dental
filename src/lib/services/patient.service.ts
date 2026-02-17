import prisma from "@/lib/db/prisma";

/**
 * Patient Service
 * Handles patient records and history aggregation
 */

export interface TimelineEvent {
    id: string;
    type: "APPOINTMENT" | "PRESCRIPTION" | "INVOICE";
    date: Date;
    title: string;
    description?: string;
    status: string;
    metadata?: any;
}

export class PatientService {
    /**
     * Get unified timeline history for a patient
     */
    static async getTimelineHistory(patientId: string, tenantId: string): Promise<TimelineEvent[]> {
        const [appointments, prescriptions, invoices] = await Promise.all([
            prisma.appointment.findMany({
                where: { patientId, tenantId },
                include: { service: true },
                orderBy: { date: "desc" },
            }),
            prisma.prescription.findMany({
                where: { patientId, tenantId },
                include: { doctor: { select: { firstName: true, lastName: true } } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.invoice.findMany({
                where: { patientId, tenantId },
                orderBy: { createdAt: "desc" },
            }),
        ]);

        const events: TimelineEvent[] = [];

        // Map Appointments
        appointments.forEach((apt) => {
            events.push({
                id: apt.id,
                type: "APPOINTMENT",
                date: apt.date,
                title: `Dental Visit: ${apt.service?.name || "General Checkup"}`,
                description: apt.notes || undefined,
                status: apt.status,
                metadata: {
                    serviceId: apt.serviceId,
                    doctorId: apt.doctorId,
                },
            });
        });

        // Map Prescriptions
        prescriptions.forEach((rx) => {
            events.push({
                id: rx.id,
                type: "PRESCRIPTION",
                date: rx.createdAt,
                title: "Prescription Issued",
                description: rx.instructions || undefined,
                status: rx.status,
                metadata: {
                    doctorId: rx.doctorId,
                    doctorName: `${rx.doctor.firstName} ${rx.doctor.lastName}`,
                    medications: rx.medications,
                },
            });
        });

        // Map Invoices
        invoices.forEach((inv) => {
            events.push({
                id: inv.id,
                type: "INVOICE",
                date: inv.createdAt,
                title: "Invoice Generated",
                description: `Amount: ${inv.currency} ${inv.totalAmount}`,
                status: inv.status,
                metadata: {
                    total: inv.totalAmount,
                    currency: inv.currency,
                },
            });
        });

        // Sort all by date descending
        return events.sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    /**
     * Get patient profile with basic stats
     */
    static async getPatientProfile(patientId: string, tenantId: string) {
        return prisma.patient.findUnique({
            where: { id: patientId, tenantId },
            include: {
                _count: {
                    select: {
                        appointments: true,
                        prescriptions: true,
                    },
                },
            },
        });
    }
}
