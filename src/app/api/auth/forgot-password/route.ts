import { NextRequest } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db/prisma";
import redis from "@/lib/db/redis";
import { apiSuccess, apiError } from "@/lib/auth";
import { sendEmail } from "@/lib/email/sender";
import { consumeRateLimit, clientIp } from "@/lib/security/rate-limit";

const RESET_TTL_SECONDS = 60 * 60; // 1 hour
const RESET_KEY_PREFIX = "pwreset:";

function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function escapeHtml(v: string): string {
    return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// POST /api/auth/forgot-password  { email }   (public)
//
// Always answers with the same generic success, whether or not the email
// belongs to an account, so the endpoint cannot be used to discover which
// addresses are registered. The reset token lives only in Redis (hashed, 1h TTL,
// single use) — nothing is written to the database.
export async function POST(request: NextRequest) {
    const generic = apiSuccess({
        message: "If an account exists for that email, a reset link has been sent.",
    });

    try {
        const body = await request.json().catch(() => ({}));
        const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
        if (!email || email.length > 254) return generic;

        const ip = clientIp(request.headers);
        const [ipLimit, emailLimit] = await Promise.all([
            consumeRateLimit(`forgot:ip:${ip}`, 10, 60 * 60),
            consumeRateLimit(`forgot:email:${email}`, 3, 60 * 60),
        ]);
        if (!ipLimit.allowed) return apiError("Too many requests. Try again later.", 429);
        if (!emailLimit.allowed) return generic; // silently stop mailing this address

        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, firstName: true, status: true, deletedAt: true },
        });
        if (!user || user.status !== "ACTIVE" || user.deletedAt) return generic;

        const token = crypto.randomBytes(32).toString("hex");
        await redis.set(`${RESET_KEY_PREFIX}${hashToken(token)}`, user.id, "EX", RESET_TTL_SECONDS);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
        const link = `${appUrl}/auth/reset-password?token=${token}`;

        await sendEmail({
            to: email,
            subject: "Reset your Nexus Dental password",
            html: `<p>Hi ${escapeHtml(user.firstName)},</p>
<p>We received a request to reset your password. This link works once and expires in 1 hour:</p>
<p><a href="${link}">Reset my password</a></p>
<p>If you didn't ask for this, you can ignore this email — your password won't change.</p>`,
        }).catch((err) => {
            console.error("[Forgot Password] Email send failed:", err instanceof Error ? err.message : err);
        });

        return generic;
    } catch (error) {
        console.error("[Forgot Password] Error:", error);
        return generic;
    }
}
