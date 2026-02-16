// ============================================
// NEXUS DENTAL — Patient OTP Verification API
// POST /api/auth/patient/otp/verify
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { verifyOTP as verifyOTPService, signPatientToken, apiError, apiSuccess } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";
import type { PatientJWTPayload } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone, tenantId, otp } = body;

        // Validate input
        if (!phone || !tenantId || !otp) {
            return apiError("Phone, clinic ID, and OTP are required", 400);
        }

        const sanitizedPhone = phone.replace(/\s+/g, "").trim();

        // Verify OTP
        const otpResult = await verifyOTPService(tenantId, sanitizedPhone, otp);
        if (!otpResult.valid) {
            return apiError(otpResult.error || "Invalid OTP", 401);
        }

        // Find patient
        const patient = await prisma.patient.findUnique({
            where: {
                tenantId_phone: {
                    tenantId,
                    phone: sanitizedPhone,
                },
            },
        });

        if (!patient) {
            return apiError("Patient not found", 404);
        }

        // Mark patient as verified
        if (!patient.isVerified) {
            await prisma.patient.update({
                where: { id: patient.id },
                data: { isVerified: true },
            });
        }

        // Build JWT payload
        const tokenPayload: PatientJWTPayload = {
            patientId: patient.id,
            tenantId: patient.tenantId,
            role: "PATIENT",
            type: "PATIENT",
        };

        // Sign token
        const token = signPatientToken(tokenPayload);

        // Log audit
        await logAudit({
            tenantId,
            userId: patient.id,
            action: "PATIENT_LOGIN_SUCCESS",
            entity: "Patient",
            entityId: patient.id,
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        const responsePayload = {
            success: true,
            token,
            patient: {
                id: patient.id,
                firstName: patient.firstName,
                lastName: patient.lastName,
                phone: patient.phone,
                tenantId: patient.tenantId,
                isVerified: true,
            },
        };

        const res = NextResponse.json(responsePayload);

        // Set secure HTTP-only cookie
        res.cookies.set("nexus_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 30, // 30 days for patients
        });

        return res;
    } catch (error) {
        console.error("[Auth] OTP verification error:", error);
        return apiError("Internal server error", 500);
    }
}
