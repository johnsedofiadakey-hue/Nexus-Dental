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
interface BillableService {
    id: string;
    name: string;
    price: number;
}

/**
 * Invoice line items for an appointment: the primary service first, then the additional services
 * ordered by name then id (so the same appointment always produces the same invoice). A service
 * that is somehow listed twice is billed once. Prices are summed in whole pesewas.
 */
export function buildInvoiceItems(primary: BillableService, additional: BillableService[]) {
    const seen = new Set<string>([primary.id]);
    const extras = [...additional]
        .filter((svc) => (seen.has(svc.id) ? false : (seen.add(svc.id), true)))
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const ordered = [primary, ...extras];
    const pesewas = ordered.reduce((sum, svc) => sum + Math.round(svc.price * 100), 0);
    return {
        items: ordered.map((svc) => ({ serviceId: svc.id, serviceName: svc.name, price: svc.price, quantity: 1 })),
        subtotal: pesewas / 100,
    };
}

export async function completeSession(
    input: SessionCompleteInput,
    ipAddress?: string,
    userAgent?: string
): Promise<SessionCompleteResult> {
    const result = await prisma.$transaction(
        async (tx: any) => {
            // 1. Verify and fetch the appointment
            const appointment = await tx.appointment.findUnique({
                where: { id: input.appointmentId },
                include: {
                    service: true,
                    additionalServices: true,
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
                // Bill EVERY service on the appointment (the primary one plus each additional one), at the
                // prices stored in the database now - never a client-supplied price. Arithmetic is done in
                // whole pesewas so the total is exact; the item list order is deterministic.
                const { items, subtotal } = buildInvoiceItems(appointment.service, appointment.additionalServices ?? []);
                const discount = input.discount ?? 0; // not `||`: a NaN discount must be rejected, not become 0
                if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) {
                    throw new Error("Discount must be between 0 and the invoice amount");
                }
                const tax = 0; // Ghana: No VAT on healthcare
                const totalAmount = Math.round((subtotal - discount) * 100) / 100 + tax;

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
                        items,
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
