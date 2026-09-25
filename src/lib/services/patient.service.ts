import prisma from "@/lib/db/prisma";

export type PatientTimelineEventType =
    | "APPOINTMENT"
    | "PRESCRIPTION"
    | "INVOICE"
    | "TREATMENT_PLAN"
    | "LAB_ORDER"
    | "FILE"
    | "CONSENT";

export interface PatientTimelineEvent {
    id: string;
    type: PatientTimelineEventType;
    date: Date;
    title: string;
    description?: string;
    status?: string;
    metadata?: Record<string, unknown>;
}

type TimelineService = { id: string; name: string };
type TimelineAppointment = {
    id: string;
    doctorId: string;
    dateTime: Date;
    status: string;
    service: TimelineService;
    additionalServices: TimelineService[];
    doctor: { firstName: string; lastName: string };
};
type TimelinePrescription = {
    id: string;
    doctorId: string;
    issuedAt: Date;
    status: string;
    doctor: { firstName: string; lastName: string };
};
type TimelineInvoice = { id: string; createdAt: Date; totalAmount: number; status: string };
type TimelinePlan = { id: string; createdAt: Date; title: string; description: string | null; status: string };
type TimelineLabOrder = { id: string; createdAt: Date; restoration: string; labName: string; status: string };
type TimelineFile = { id: string; createdAt: Date; filename: string; category: string };
type TimelineConsent = { id: string; signedAt: Date; template: { title: string } };

/**
 * Patient-facing and staff-facing record aggregation.
 * Every query is scoped by both patient and clinic so a caller can never
 * assemble a cross-clinic chart by guessing an identifier.
 */
export class PatientService {
    static async getTimelineHistory(patientId: string, tenantId: string) {
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, tenantId, deletedAt: null },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
                dateOfBirth: true,
                gender: true,
                bloodType: true,
                allergies: true,
                medicalNotes: true,
                insuranceProvider: true,
                insurancePolicyNo: true,
                avatar: true,
                lastVisitAt: true,
            },
        });

        if (!patient) throw new Error("Patient not found");

        const [
            rawAppointments,
            prescriptions,
            invoices,
            treatmentPlans,
            toothRecords,
            files,
            labOrders,
            consents,
            supportTickets,
        ] = await Promise.all([
            prisma.appointment.findMany({
                where: { patientId, tenantId, deletedAt: null },
                include: {
                    service: true,
                    additionalServices: true,
                    doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
                },
                orderBy: { dateTime: "desc" },
            }),
            prisma.prescription.findMany({
                where: { patientId, tenantId, deletedAt: null },
                include: { doctor: { select: { id: true, firstName: true, lastName: true } } },
                orderBy: { issuedAt: "desc" },
            }),
            prisma.invoice.findMany({
                where: { patientId, tenantId, deletedAt: null },
                include: { claims: { orderBy: { createdAt: "desc" } } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.treatmentPlan.findMany({
                where: { patientId, tenantId, deletedAt: null },
                include: {
                    steps: { orderBy: { stepNumber: "asc" } },
                    doctor: { select: { id: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.toothRecord.findMany({
                where: { patientId, tenantId },
                orderBy: { toothNumber: "asc" },
            }),
            prisma.patientFile.findMany({
                where: { patientId, tenantId },
                include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.labOrder.findMany({
                where: { patientId, tenantId },
                include: { doctor: { select: { id: true, firstName: true, lastName: true } } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.patientConsent.findMany({
                where: { patientId, tenantId },
                include: { template: { select: { id: true, title: true, category: true, version: true } } },
                orderBy: { signedAt: "desc" },
            }),
            prisma.supportTicket.findMany({
                where: { patientId, tenantId },
                include: {
                    messages: {
                        where: { isInternal: false },
                        orderBy: { timestamp: "asc" },
                    },
                },
                orderBy: { updatedAt: "desc" },
            }),
        ]);

        const appointments = (rawAppointments as TimelineAppointment[]).map(({ service, additionalServices, ...appointment }) => ({
            ...appointment,
            services: [service, ...additionalServices].filter(Boolean),
        }));

        const timeline: PatientTimelineEvent[] = [
            ...appointments.map((appointment) => ({
                id: appointment.id,
                type: "APPOINTMENT" as const,
                date: appointment.dateTime,
                title: appointment.services.map((service) => service.name).join(", ") || "Dental appointment",
                description: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
                status: appointment.status,
                metadata: { doctorId: appointment.doctorId },
            })),
            ...(prescriptions as TimelinePrescription[]).map((prescription) => ({
                id: prescription.id,
                type: "PRESCRIPTION" as const,
                date: prescription.issuedAt,
                title: "Prescription issued",
                description: `Dr. ${prescription.doctor.firstName} ${prescription.doctor.lastName}`,
                status: prescription.status,
                metadata: { doctorId: prescription.doctorId },
            })),
            ...(invoices as TimelineInvoice[]).map((invoice) => ({
                id: invoice.id,
                type: "INVOICE" as const,
                date: invoice.createdAt,
                title: `Invoice #${invoice.id.slice(-6).toUpperCase()}`,
                description: `GHS ${invoice.totalAmount.toFixed(2)}`,
                status: invoice.status,
            })),
            ...(treatmentPlans as TimelinePlan[]).map((plan) => ({
                id: plan.id,
                type: "TREATMENT_PLAN" as const,
                date: plan.createdAt,
                title: plan.title,
                description: plan.description || undefined,
                status: plan.status,
            })),
            ...(labOrders as TimelineLabOrder[]).map((order) => ({
                id: order.id,
                type: "LAB_ORDER" as const,
                date: order.createdAt,
                title: `${order.restoration} lab order`,
                description: order.labName,
                status: order.status,
            })),
            ...(files as TimelineFile[]).map((file) => ({
                id: file.id,
                type: "FILE" as const,
                date: file.createdAt,
                title: file.filename,
                description: file.category,
                status: "AVAILABLE",
            })),
            ...(consents as TimelineConsent[]).map((consent) => ({
                id: consent.id,
                type: "CONSENT" as const,
                date: consent.signedAt,
                title: consent.template.title,
                description: "Consent signed",
                status: "SIGNED",
            })),
        ].sort((a, b) => b.date.getTime() - a.date.getTime());

        return {
            patient,
            appointments,
            prescriptions,
            invoices,
            treatmentPlans,
            toothRecords,
            files,
            labOrders,
            consents,
            supportTickets,
            timeline,
        };
    }

    static async getPatientProfile(patientId: string, tenantId: string) {
        return prisma.patient.findFirst({
            where: { id: patientId, tenantId, deletedAt: null },
            include: {
                _count: {
                    select: {
                        appointments: true,
                        prescriptions: true,
                        invoices: true,
                        treatmentPlans: true,
                        labOrders: true,
                        patientFiles: true,
                    },
                },
            },
        });
    }
}
