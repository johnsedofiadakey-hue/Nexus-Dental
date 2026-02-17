import prisma from "@/lib/db/prisma";
import { PrescriptionStatus } from "@prisma/client";

/**
 * Pharmacy Service
 * Handles prescription lifecycle and inventory integration
 */

export interface MedicationItem {
    name: string;
    dosage: string;
    quantity: number;
    instructions?: string;
    inventoryId?: string; // Linked inventory item
}

export class PharmacyService {
    /**
     * Create a new prescription
     */
    static async createPrescription(data: {
        tenantId: string;
        patientId: string;
        doctorId: string;
        appointmentId?: string;
        medications: MedicationItem[];
        instructions?: string;
        validUntil?: Date;
    }) {
        return prisma.prescription.create({
            data: {
                tenantId: data.tenantId,
                patientId: data.patientId,
                doctorId: data.doctorId,
                appointmentId: data.appointmentId,
                medications: data.medications as any,
                instructions: data.instructions,
                validUntil: data.validUntil,
                status: "PENDING",
            },
            include: {
                patient: true,
                doctor: true,
            },
        });
    }

    /**
     * Get prescriptions for a tenant
     */
    static async getPrescriptions(tenantId: string, status?: PrescriptionStatus) {
        return prisma.prescription.findMany({
            where: {
                tenantId,
                ...(status ? { status } : {}),
            },
            include: {
                patient: true,
                doctor: true,
            },
            orderBy: { createdAt: "desc" },
        });
    }

    /**
     * Fulfill a prescription and deduct from inventory
     */
    static async fulfillPrescription(prescriptionId: string, tenantId: string) {
        return prisma.$transaction(async (tx) => {
            // 1. Get the prescription
            const prescription = await tx.prescription.findUnique({
                where: { id: prescriptionId, tenantId },
            });

            if (!prescription) throw new Error("Prescription not found");
            if (prescription.status !== "PENDING") throw new Error("Prescription is not pending");

            const medications = prescription.medications as unknown as MedicationItem[];

            // 2. Process each medication
            for (const med of medications) {
                if (med.inventoryId) {
                    // Try to deduct from inventory
                    const item = await tx.inventoryItem.findUnique({
                        where: { id: med.inventoryId, tenantId },
                    });

                    if (item) {
                        if (item.quantity < med.quantity) {
                            throw new Error(`Insufficient stock for ${med.name}. Available: ${item.quantity}, Requested: ${med.quantity}`);
                        }

                        await tx.inventoryItem.update({
                            where: { id: item.id },
                            data: { quantity: { decrement: med.quantity } },
                        });

                        // Log inventory deduction in audit
                        // TODO: Add AuditLog entry
                    }
                }
            }

            // 3. Update prescription status
            return tx.prescription.update({
                where: { id: prescriptionId },
                data: { status: "FILLED" },
            });
        });
    }

    /**
     * Get patient prescription history
     */
    static async getPatientHistory(patientId: string, tenantId: string) {
        return prisma.prescription.findMany({
            where: { patientId, tenantId },
            include: {
                doctor: {
                    select: { firstName: true, lastName: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
}
