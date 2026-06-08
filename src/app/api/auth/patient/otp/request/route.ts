import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getClinicId } from "@/lib/clinic";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone } = body as { phone: string };

        if (!phone) {
            return NextResponse.json({ success: false, error: "Phone number is required." }, { status: 400 });
        }

        const tenantId = getClinicId();
        let normalizedPhone = phone.replace(/\s+/g, "");
        if (normalizedPhone.startsWith("0")) normalizedPhone = normalizedPhone.substring(1);
        if (!normalizedPhone.startsWith("+233")) normalizedPhone = `+233${normalizedPhone}`;

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
            select: { id: true, firstName: true },
        });

        if (!patient) {
            return NextResponse.json({
                success: false,
                error: "No account found with this phone number. Please book an appointment first.",
            }, { status: 200 });
        }

        return NextResponse.json({ success: true, message: "Proceed with Firebase OTP" });
    } catch (err) {
        console.error("[patient/otp/request]", err);
        return NextResponse.json({ success: false, error: "Failed to process request." }, { status: 500 });
    }
}
