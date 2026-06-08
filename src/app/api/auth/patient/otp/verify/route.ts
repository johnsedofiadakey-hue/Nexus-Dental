import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { verifyOTP, signPatientToken } from "@/lib/auth";
import { getClinicId } from "@/lib/clinic";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone, otp } = body as { phone: string; otp: string };

        if (!phone || !otp) {
            return NextResponse.json({ success: false, error: "Phone and OTP are required." }, { status: 400 });
        }

        const tenantId = getClinicId();
        let normalizedPhone = phone.replace(/\s+/g, "");
        if (normalizedPhone.startsWith("0")) normalizedPhone = normalizedPhone.substring(1);
        if (!normalizedPhone.startsWith("+233")) normalizedPhone = `+233${normalizedPhone}`;

        const result = await verifyOTP(tenantId, normalizedPhone, otp);
        if (!result.valid) {
            return NextResponse.json({ success: false, error: result.error }, { status: 401 });
        }

        const patient = await prisma.patient.findFirst({
            where: { tenantId, phone: normalizedPhone },
            select: { id: true, firstName: true, lastName: true, tenantId: true },
        });

        if (!patient) {
            return NextResponse.json({ success: false, error: "Patient not found." }, { status: 400 });
        }

        const token = signPatientToken({
            patientId: patient.id,
            tenantId: patient.tenantId,
            role: "PATIENT",
            type: "PATIENT",
        });

        const response = NextResponse.json({
            success: true,
            data: { patient: { id: patient.id, firstName: patient.firstName, lastName: patient.lastName } },
        });

        response.cookies.set("nexus_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
        });

        return response;
    } catch (err) {
        console.error("[patient/otp/verify]", err);
        return NextResponse.json({ success: false, error: "Verification failed." }, { status: 500 });
    }
}
