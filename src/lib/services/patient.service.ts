import prisma from "@/lib/db/prisma";

/**
 * Patient Service
 * Handles patient records and history aggregation
 */

export interface TimelineEvent {
    id: string;
    type: "APPOINTMENT" | "PRESCRIPTION" | "INVOICE" | "INTERACTION" | "BILLING";
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
        const [appointments, prescriptions, invoices, logs] = await Promise.all([
            prisma.appointment.findMany({
                where: { patientId, tenantId },
                include: { service: true },
                orderBy: { dateTime: "desc" },
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
            prisma.auditLog.findMany({
                where: { entityId: patientId, tenantId },
                include: { user: true },
                orderBy: { timestamp: "desc" },
            }),
        ]);

        const events: TimelineEvent[] = [];

        // Map Appointments
        appointments.forEach((apt: any) => {
            events.push({
                id: apt.id,
                type: "APPOINTMENT",
                date: apt.dateTime,
                title: `${apt.service.name} with Dr. ${apt.doctor.lastName}`,
                description: apt.notes || "",
                status: apt.status,
                metadata: { serviceId: apt.service.id, doctorId: apt.doctor.id },
            });
        });

        // Map Audit Logs (Interactions)
        logs.forEach((log: any) => {
            events.push({
                id: log.id,
                type: "INTERACTION",
                date: log.timestamp,
                title: log.action,
                description: `Action performed by ${log.user.firstName} ${log.user.lastName}`,
                status: "COMPLETED",
                metadata: { userId: log.user.id },
            });
        });

        // Map Prescriptions
        prescriptions.forEach((rx: any) => {
            events.push({
                id: rx.id,
                type: "PRESCRIPTION",
                date: rx.createdAt,
                title: "Prescription Issued",
                description: "Medications prescribed by doctor",
                status: rx.status,
                metadata: { doctorId: rx.doctorId },
            });
        });

        // Map Invoices
        invoices.forEach((inv: any) => {
            events.push({
                id: inv.id,
                type: "BILLING",
                date: inv.createdAt,
                title: `Invoice #${inv.id.slice(-6).toUpperCase()}`,
                description: `Amount: $${inv.totalAmount.toFixed(2)}`,
                status: inv.status,
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
