import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/auth";
import bcrypt from "bcryptjs";

/**
 * GET /api/staff - List all employees for the current tenant
 * POST /api/staff - Create new employee
 */

export async function GET(request: NextRequest) {
    try {
        // TODO: Get tenantId from authenticated user's JWT
        // For now, using Airport Hills as example
        const tenantId = "airport-hills-dental";

        const employees = await prisma.user.findMany({
            where: {
                tenantId,
                role: {
                    in: ["DOCTOR", "NURSE", "RECEPTIONIST", "INVENTORY_MANAGER", "BILLING_STAFF"],
                },
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                status: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return apiSuccess({ employees });
    } catch (error) {
        console.error("[Staff API] Fetch error:", error);
        return apiError("Failed to fetch employees", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { firstName, lastName, email, phone, role } = body;

        // Validation
        if (!firstName || !lastName || !email || !role) {
            return apiError("First name, last name, email, and role are required", 400);
        }

        // Validate role
        const validRoles = ["DOCTOR", "NURSE", "RECEPTIONIST", "INVENTORY_MANAGER", "BILLING_STAFF"];
        if (!validRoles.includes(role)) {
            return apiError("Invalid role", 400);
        }

        // Check if email already exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return apiError("Email already in use", 400);
        }

        // Generate temporary password
        const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        // TODO: Get tenantId from authenticated user's JWT
        const tenantId = "airport-hills-dental";

        // Create employee
        const employee = await prisma.user.create({
            data: {
                email,
                passwordHash,
                firstName,
                lastName,
                phone: phone || null,
                role,
                status: "ACTIVE",
                tenantId,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                status: true,
            },
        });

        // TODO: Send email with temporary password
        console.log(`[Staff API] Created employee ${email} with temp password: ${tempPassword}`);

        return apiSuccess(
            {
                employee,
                tempPassword, // Return this so the UI can show it
            },
            201
        );
    } catch (error) {
        console.error("[Staff API] Creation error:", error);
        return apiError("Failed to create employee", 500);
    }
}
