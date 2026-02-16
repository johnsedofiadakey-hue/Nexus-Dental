// ============================================
// NEXUS DENTAL — Inventory Engine
// Auto-deduct items based on procedure mapping
// ============================================

import prisma from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit/logger";

export interface InventoryDeduction {
    inventoryItemId: string;
    itemName: string;
    quantityUsed: number;
    previousQuantity: number;
    newQuantity: number;
}

export interface LowStockAlert {
    itemId: string;
    itemName: string;
    currentQuantity: number;
    threshold: number;
}

/**
 * Auto-deduct inventory items for a completed procedure.
 * Uses the ProcedureInventoryMap to determine what to deduct.
 *
 * Returns deduction records and any low-stock alerts.
 */
export async function deductInventoryForProcedure(
    tenantId: string,
    serviceId: string,
    userId: string,
    appointmentId: string,
    tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<{
    deductions: InventoryDeduction[];
    lowStockAlerts: LowStockAlert[];
}> {
    const db = tx || prisma;

    // Get procedure-inventory mappings
    const mappings = await db.procedureInventoryMap.findMany({
        where: { serviceId },
        include: {
            inventoryItem: true,
        },
    });

    const deductions: InventoryDeduction[] = [];
    const lowStockAlerts: LowStockAlert[] = [];

    for (const mapping of mappings) {
        const item = mapping.inventoryItem;
        const quantityToDeduct = mapping.quantityUsed;

        // Check if sufficient stock
        if (item.quantity < quantityToDeduct) {
            throw new Error(
                `Insufficient stock for ${item.name}: need ${quantityToDeduct}, have ${item.quantity}`
            );
        }

        const previousQuantity = item.quantity;
        const newQuantity = previousQuantity - quantityToDeduct;

        // Deduct
        await db.inventoryItem.update({
            where: { id: item.id },
            data: { quantity: newQuantity },
        });

        deductions.push({
            inventoryItemId: item.id,
            itemName: item.name,
            quantityUsed: quantityToDeduct,
            previousQuantity,
            newQuantity,
        });

        // Check low-stock threshold
        if (newQuantity <= item.threshold) {
            lowStockAlerts.push({
                itemId: item.id,
                itemName: item.name,
                currentQuantity: newQuantity,
                threshold: item.threshold,
            });
        }
    }

    // Audit log (outside transaction if no tx provided)
    if (!tx) {
        await logAudit({
            tenantId,
            userId,
            action: "INVENTORY_AUTO_DEDUCTED",
            entity: "Appointment",
            entityId: appointmentId,
            newValue: { deductions, lowStockAlerts },
        });
    }

    return { deductions, lowStockAlerts };
}

/**
 * Manually adjust inventory (with override logging).
 */
export async function adjustInventory(
    tenantId: string,
    itemId: string,
    adjustment: number,
    reason: string,
    userId: string
): Promise<{ item: { id: string; name: string; quantity: number }; previousQuantity: number }> {
    const item = await prisma.inventoryItem.findFirst({
        where: { id: itemId, tenantId },
    });

    if (!item) {
        throw new Error("Inventory item not found");
    }

    const previousQuantity = item.quantity;
    const newQuantity = previousQuantity + adjustment;

    if (newQuantity < 0) {
        throw new Error(
            `Cannot reduce ${item.name} below 0. Current: ${previousQuantity}, adjustment: ${adjustment}`
        );
    }

    const updated = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { quantity: newQuantity },
        select: { id: true, name: true, quantity: true },
    });

    // Log the override
    await prisma.actionControlLog.create({
        data: {
            tenantId,
            userId,
            action: "INVENTORY_ADJUST",
            entity: "InventoryItem",
            entityId: itemId,
            reason,
            oldValue: { quantity: previousQuantity },
            newValue: { quantity: newQuantity, adjustment },
        },
    });

    return { item: updated, previousQuantity };
}

/**
 * Get inventory items with low-stock warnings.
 */
export async function getLowStockItems(tenantId: string) {
    const items = await prisma.inventoryItem.findMany({
        where: {
            tenantId,
            quantity: { lte: prisma.inventoryItem.fields.threshold as unknown as number },
        },
    });

    // Workaround: since Prisma doesn't support comparing fields directly,
    // we filter in-memory
    const allItems = await prisma.inventoryItem.findMany({
        where: { tenantId },
        orderBy: { quantity: "asc" },
    });

    return allItems.filter((item) => item.quantity <= item.threshold);
}
