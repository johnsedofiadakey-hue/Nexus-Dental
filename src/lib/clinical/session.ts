// ============================================
// NEXUS DENTAL — Doctor Session Cascade
// Atomic transaction: status → inventory → prescription → invoice
// ============================================

import prisma from "@/lib/db/prisma";
import { deductInventoryForProcedure } from "./inventory";
import { logAudit } from "@/lib/audit/logger";

export interface SessionCompleteInput {
    appointmentId: string;
    tenantId: string;
    doctorId: string;
    clinicalNotes?: string;
    medications?: Array<{
        name: string;
        dosage: string;
        frequency: string;
        duration: string;
        notes?: string;
    }>;
    prescriptionInstructions?: string;
    generateInvoice?: boolean;
    discount?: number;
    invoiceNotes?: string;
}

export interface SessionCompleteResult {
    appointment: {
        id: string;
        status: string;
    };
    prescription?: {
        id: string;
        medications: unknown;
    };
    invoice?: {
        id: string;
        totalAmount: number;
        status: string;
    };
    inventoryDeductions: Array<{
        itemName: string;
        quantityUsed: number;
    }>;
    lowStockAlerts: Array<{
        itemName: string;
        currentQuantity: number;
        threshold: number;
    }>;
}

/**
 * Complete a doctor session atomically.
 *
 * This executes the entire post-treatment flow in a single transaction:
 * 1. Transition appointment status: IN_CHAIR → COMPLETED
 * 2. Record appointment transition with clinical notes
 * 3. Auto-deduct inventory items (if procedure maps exist)
 * 4. Create prescription (if medications provided)
 * 5. Generate invoice (if requested)
 * 6. Log the audit event
 */
export async function completeSession(
    input: SessionCompleteInput,
    ipAddress?: string,
    userAgent?: string
): Promise<SessionCompleteResult> {
    const result = await prisma.$transaction(
        async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
            // 1. Verify and fetch the appointment
            const appointment = await tx.appointment.findUnique({
                where: { id: input.appointmentId },
                include: {
                    service: true,
                    patient: true,
                },
            });

            if (!appointment) {
                throw new Error("Appointment not found");
            }

            if (appointment.tenantId !== input.tenantId) {
                throw new Error("Tenant mismatch");
            }

            if (appointment.doctorId !== input.doctorId) {
                throw new Error("Only the assigned doctor can complete this session");
            }

            if (appointment.status !== "IN_CHAIR") {
                throw new Error(
                    `Cannot complete session: appointment is ${appointment.status}, expected IN_CHAIR`
                );
            }

            // 2. Transition to COMPLETED
            await tx.appointment.update({
                where: { id: input.appointmentId },
                data: {
                    status: "COMPLETED",
                    completedAt: new Date(),
                    notes: input.clinicalNotes || appointment.notes,
                },
            });

            await tx.appointmentTransition.create({
                data: {
                    appointmentId: input.appointmentId,
                    fromStatus: "IN_CHAIR",
                    toStatus: "COMPLETED",
                    triggeredBy: input.doctorId,
                    reason: input.clinicalNotes || "Session completed by doctor",
                },
            });

            // 3. Auto-deduct inventory
            const { deductions, lowStockAlerts } =
                await deductInventoryForProcedure(
                    input.tenantId,
                    appointment.serviceId,
                    input.doctorId,
                    input.appointmentId,
                    tx
                );

            // 4. Create prescription (if medications provided)
            let prescription = null;
            if (input.medications && input.medications.length > 0) {
                prescription = await tx.prescription.create({
                    data: {
                        tenantId: input.tenantId,
                        patientId: appointment.patientId,
                        appointmentId: input.appointmentId,
                        doctorId: input.doctorId,
                        medications: input.medications,
                        instructions: input.prescriptionInstructions || null,
                    },
                });
            }

            // 5. Generate invoice (if requested)
            let invoice = null;
            if (input.generateInvoice !== false) {
                const service = appointment.service;
                const subtotal = service.price;
                const discount = input.discount || 0;
                const tax = subtotal * 0.0; // Ghana: No VAT on healthcare
                const totalAmount = subtotal - discount + tax;

                invoice = await tx.invoice.create({
                    data: {
                        tenantId: input.tenantId,
                        patientId: appointment.patientId,
                        appointmentId: input.appointmentId,
                        createdById: input.doctorId,
                        amount: subtotal,
                        tax,
                        discount,
                        totalAmount,
                        status: "UNPAID",
                        notes: input.invoiceNotes || null,
                        items: [
                            {
                                serviceId: service.id,
                                serviceName: service.name,
                                price: service.price,
                                quantity: 1,
                            },
                        ],
                    },
                });
            }

            return {
                appointment: {
                    id: input.appointmentId,
                    status: "COMPLETED",
                },
                prescription: prescription
                    ? {
                        id: prescription.id,
                        medications: prescription.medications,
                    }
                    : undefined,
                invoice: invoice
                    ? {
                        id: invoice.id,
                        totalAmount: invoice.totalAmount,
                        status: invoice.status,
                    }
                    : undefined,
                inventoryDeductions: deductions.map((d) => ({
                    itemName: d.itemName,
                    quantityUsed: d.quantityUsed,
                })),
                lowStockAlerts: lowStockAlerts.map((a) => ({
                    itemName: a.itemName,
                    currentQuantity: a.currentQuantity,
                    threshold: a.threshold,
                })),
            };
        }
    );

    // Audit log (outside transaction for performance)
    await logAudit({
        tenantId: input.tenantId,
        userId: input.doctorId,
        action: "SESSION_COMPLETED",
        entity: "Appointment",
        entityId: input.appointmentId,
        newValue: {
            hasPresc: !!result.prescription,
            hasInvoice: !!result.invoice,
            deductions: result.inventoryDeductions.length,
            lowStockAlerts: result.lowStockAlerts.length,
        },
        ipAddress,
        userAgent,
    });

    return result;
}
