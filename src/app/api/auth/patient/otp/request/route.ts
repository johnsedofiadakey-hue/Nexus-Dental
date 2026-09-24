import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getClinicId } from "@/lib/clinic";
import { consumeRateLimit, clientIp } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
    try {
        // Durable (Redis) limits: 10 requests / 15 min per IP.
        const ip = clientIp(request.headers);
        const ipLimit = await consumeRateLimit(`otp-request:ip:${ip}`, 10, 15 * 60);
        if (!ipLimit.allowed) {
            return NextResponse.json(
                { success: false, error: "Too many requests. Try again later." },
                { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
            );
        }

        const body = await request.json();
        const { phone } = body as { phone: string };

        if (!phone) {
            return NextResponse.json({ success: false, error: "Phone number is required." }, { status: 400 });
        }

        const tenantId = getClinicId();
        let normalizedPhone = phone.replace(/\s+/g, "");
        if (normalizedPhone.startsWith("0")) normalizedPhone = normalizedPhone.substring(1);
        if (!normalizedPhone.startsWith("+233")) normalizedPhone = `+233${normalizedPhone}`;

        // Also cap per phone number (5 / 15 min) so one number can't be SMS-bombed
        // from many IPs.
        const phoneLimit = await consumeRateLimit(`otp-request:phone:${normalizedPhone}`, 5, 15 * 60);
        if (!phoneLimit.allowed) {
            return NextResponse.json(
                { success: false, error: "Too many requests. Try again later." },
                { status: 429, headers: { "Retry-After": String(phoneLimit.retryAfterSeconds) } }
            );
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
            select: { id: true, firstName: true },
        });

        if (!patient) {
            return NextResponse.json({
                success: false,
                error: "No account found with this phone number. Please book an appointment first.",
            }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Proceed with Firebase OTP" });
    } catch (err) {
        console.error("[patient/otp/request]", err);
        return NextResponse.json({ success: false, error: "Failed to process request." }, { status: 500 });
    }
}
