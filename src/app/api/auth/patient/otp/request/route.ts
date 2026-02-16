// ============================================
// NEXUS DENTAL — Patient OTP Request API
// POST /api/auth/patient/otp/request
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { generateOTP, storeOTP, apiError, apiSuccess } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone, tenantId } = body;

        // Validate input
        if (!phone || !tenantId) {
            return apiError("Phone number and clinic ID are required", 400);
        }

        // Sanitize phone number
        const sanitizedPhone = phone.replace(/\s+/g, "").trim();

        // Verify tenant exists and is active
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
        });

        if (!tenant || tenant.status !== "ACTIVE") {
            return apiError("Clinic not found or not active", 404);
        }

        // Find or create patient record
        let patient = await prisma.patient.findUnique({
            where: {
                tenantId_phone: {
                    tenantId,
                    phone: sanitizedPhone,
                },
            },
        });

        if (!patient) {
            // Create a minimal patient record (they'll complete profile later)
            patient = await prisma.patient.create({
                data: {
                    tenantId,
                    phone: sanitizedPhone,
                    firstName: "Patient",
                    lastName: "",
                },
            });
        }

        // Generate and store OTP
        const otp = generateOTP();
        await storeOTP(tenantId, sanitizedPhone, otp);

        // TODO: Send OTP via WhatsApp (Meta API) with SMS fallback (Arkesel/Hubtel)
        // For now, log the OTP in development
        if (process.env.NODE_ENV === "development") {
            console.log(`[OTP] Code for ${sanitizedPhone}: ${otp}`);
        }

        // Log audit
        await logAudit({
            tenantId,
            userId: patient.id,
            action: "PATIENT_OTP_REQUESTED",
            entity: "Patient",
            entityId: patient.id,
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        return apiSuccess({
            message: "OTP sent successfully",
            // Include OTP in dev mode for testing
            ...(process.env.NODE_ENV === "development" ? { otp } : {}),
        });
    } catch (error) {
        console.error("[Auth] OTP request error:", error);
        return apiError("Internal server error", 500);
    }
}
