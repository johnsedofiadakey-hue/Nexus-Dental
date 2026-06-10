import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getClinicId } from "@/lib/clinic";

const rateLimitMap = new Map<string, { count: number; lastRequest: number }>();

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 5;

    const record = rateLimitMap.get(ip);
    if (!record || (now - record.lastRequest > windowMs)) {
        rateLimitMap.set(ip, { count: 1, lastRequest: now });
        return true;
    }
    
    if (record.count >= maxRequests) {
        return false;
    }

    record.count++;
    record.lastRequest = now;
    return true;
}

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get("x-forwarded-for") || "unknown";
        if (!checkRateLimit(ip)) {
            return NextResponse.json({ success: false, error: "Too many requests. Try again later." }, { status: 429 });
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
