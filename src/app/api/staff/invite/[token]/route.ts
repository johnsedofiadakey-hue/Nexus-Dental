import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/auth";
import { inviteTokenLookupValues } from "@/lib/auth/invite-token";

// GET /api/staff/invite/[token] — validate a token and return invite details (public)
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        // Tokens are stored hashed; legacy rows holding the raw token still resolve.
        const invite = await prisma.staffInvite.findFirst({
            where: { token: { in: inviteTokenLookupValues(token) } },
            include: {
                tenant: { select: { id: true, name: true, logo: true } },
                invitedBy: { select: { firstName: true, lastName: true } },
            },
        });

        if (!invite) return apiError("Invite not found or already used", 404);
        if (invite.acceptedAt) return apiError("This invitation has already been accepted", 410);
        if (invite.expiresAt < new Date()) return apiError("This invitation has expired. Ask your admin to resend it.", 410);

        return apiSuccess({
            email: invite.email,
            role: invite.role,
            clinic: invite.tenant,
            invitedBy: `${invite.invitedBy.firstName} ${invite.invitedBy.lastName}`,
            expiresAt: invite.expiresAt,
        });
    } catch (error) {
        return apiError("Internal server error", 500);
    }
}
