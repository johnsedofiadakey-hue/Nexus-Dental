import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { JWTPayload } from "@/lib/auth/types";


/**
 * GET /api/staff - List all employees for the current tenant
 */
export async function GET(request: NextRequest) {
    try {
        const user = authenticateRequest(request);
        if (!user || !user.tenantId) {
            return apiError("Unauthorized", 401);
        }

        const employees = await prisma.user.findMany({
            where: {
                tenantId: user.tenantId,
                role: {

                    in: ["DOCTOR", "NURSE", "RECEPTIONIST", "INVENTORY_MANAGER", "BILLING_STAFF", "ADMIN", "CLINIC_OWNER"],
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

/**
 * POST /api/staff - Create new employee
 */
export async function POST(request: NextRequest) {
    try {
        const user = authenticateRequest(request);
        if (!user || !user.tenantId) {
            return apiError("Unauthorized", 401);
        }

        // Only Owners and Admins can create staff
        const staffUser = user as JWTPayload;
        const allowedCreators = ["SYSTEM_OWNER", "CLINIC_OWNER", "ADMIN"];
        if (!allowedCreators.includes(staffUser.role)) {
            return apiError("Forbidden: You do not have permission to manage staff", 403);
        }


        const body = await request.json();
        const { firstName, lastName, email, phone, role } = body;

        // Validation
        if (!firstName || !lastName || !email || !role) {
            return apiError("First name, last name, email, and role are required", 400);
        }

        // Check if email already exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return apiError("Email already in use", 400);
        }

        // Generate temporary password
        const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;
        const passwordHash = await bcrypt.hash(tempPassword, 10);

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
                tenantId: user.tenantId,
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

        return apiSuccess(
            {
                employee,
                tempPassword,
            },
            "Staff member created successfully",
            201
        );
    } catch (error) {
        console.error("[Staff API] Creation error:", error);
        return apiError("Failed to create employee", 500);
    }
}

