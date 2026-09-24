import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { signPatientToken } from "@/lib/auth";
import { AUTH_CONFIG } from "@/lib/auth/types";
import { getClinicId } from "@/lib/clinic";
import { adminAuth } from "@/lib/firebase/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone, otp, token } = body as { phone: string; otp: string; token: string };

        if (!phone || !token) {
            return NextResponse.json({ success: false, error: "Phone and token are required." }, { status: 400 });
        }

        const tenantId = getClinicId();
        let normalizedPhone = phone.replace(/\s+/g, "");
        if (normalizedPhone.startsWith("0")) normalizedPhone = normalizedPhone.substring(1);
        if (!normalizedPhone.startsWith("+233")) normalizedPhone = `+233${normalizedPhone}`;

        // The Firebase token proves control of *a* phone number. It must be the
        // same number the caller is asking to log in as, otherwise anyone with
        // any valid token could request a session for another patient.
        try {
            const decoded = await adminAuth.verifyIdToken(token);
            if (!decoded.phone_number || decoded.phone_number !== normalizedPhone) {
                console.warn("[patient/otp/verify] Token phone does not match requested phone");
                return NextResponse.json({ success: false, error: "Invalid token." }, { status: 401 });
            }
        } catch (err) {
            console.error("Firebase token verification failed:", err);
            return NextResponse.json({ success: false, error: "Invalid token." }, { status: 401 });
        }

        const stripped = normalizedPhone.replace("+233", "");
        const patient = await prisma.patient.findFirst({
            where: { 
                tenantId, 
                OR: [
                    { phone: normalizedPhone },
                    { phone: `0${stripped}` },
                    { phone: stripped }
                ]
            },
            select: { id: true, firstName: true, lastName: true, tenantId: true },
        });

        if (!patient) {
            return NextResponse.json({ success: false, error: "Patient not found." }, { status: 200 });
        }

        const nexusToken = signPatientToken({
            patientId: patient.id,
            tenantId: patient.tenantId,
            role: "PATIENT",
            type: "PATIENT",
        });

        const response = NextResponse.json({
            success: true,
            data: { patient: { id: patient.id, firstName: patient.firstName, lastName: patient.lastName } },
        });

        response.cookies.set("nexus_patient_token", nexusToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: AUTH_CONFIG.PATIENT_SESSION_MAX_AGE_SECONDS,
        });

        return response;
    } catch (err) {
        console.error("[patient/otp/verify]", err);
        return NextResponse.json({ success: false, error: "Verification failed." }, { status: 500 });
    }
}
