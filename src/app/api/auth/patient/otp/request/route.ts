import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { generateOTP, storeOTP } from "@/lib/auth";
import { sendSMS } from "@/lib/sms/hubtel";
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

        const patient = await prisma.patient.findFirst({
            where: { tenantId, phone: normalizedPhone },
            select: { id: true, firstName: true },
        });

        if (!patient) {
            return NextResponse.json({
                success: false,
                error: "No account found with this phone number. Please book an appointment first.",
            }, { status: 400 });
        }

        const otp = generateOTP();
        await storeOTP(tenantId, normalizedPhone, otp);

        const clinic = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
        const message = `Your ${clinic?.name ?? "Nexus Dental"} login code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
        await sendSMS(normalizedPhone, message);

        return NextResponse.json({ success: true, data: { message: "Verification code sent." } });
    } catch (err) {
        console.error("[patient/otp/request]", err);
        return NextResponse.json({ success: false, error: "Failed to send verification code." }, { status: 500 });
    }
}
