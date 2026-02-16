import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, getUserTenantId } from "@/lib/auth/middleware";

// GET /api/system/settings - Get current tenant/system settings
export async function GET(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const tenantId = getUserTenantId(req);
    if (!tenantId) return NextResponse.json({ success: false, error: "Tenant context required" }, { status: 400 });

    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                name: true,
                logo: true,
                email: true,
                phone: true,
                address: true,
                website: true,
                settings: true,
            },
        });

        return NextResponse.json({ success: true, data: tenant });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

// POST /api/system/settings - Update settings
export async function POST(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const tenantId = getUserTenantId(req);
    if (!tenantId) return NextResponse.json({ success: false, error: "Tenant context required" }, { status: 400 });

    try {
        const body = await req.json();
        const { name, logo, email, phone, address, website, settings } = body;

        const updatedTenant = await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                name,
                logo,
                email,
                phone,
                address,
                website,
                settings: settings || undefined, // Merge with existing Json if needed
            },
        });

        return NextResponse.json({ success: true, data: updatedTenant });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to update settings" }, { status: 500 });
    }
}
