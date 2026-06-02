import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { hashPassword, signToken, apiError, apiSuccess } from "@/lib/auth";

// POST /api/onboarding — One-time clinic setup. Only works if no clinic exists yet.
export async function POST(request: NextRequest) {
    try {
        // Single-clinic guard: refuse if a clinic already exists
        const existingClinic = await prisma.tenant.findFirst();
        if (existingClinic) {
            return apiError("Clinic already configured. This endpoint is disabled.", 409);
        }

        const body = await request.json();
        const {
            clinicName,
            slug,
            email,
            phone,
            address,
            timezone = "Africa/Accra",
            ownerFirstName,
            ownerLastName,
            ownerEmail,
            ownerPhone,
            password,
        } = body;

        if (!clinicName || !slug || !ownerFirstName || !ownerLastName || !ownerEmail || !password) {
            return apiError("clinicName, slug, ownerFirstName, ownerLastName, ownerEmail, and password are required", 400);
        }

        if (password.length < 8) {
            return apiError("Password must be at least 8 characters", 400);
        }

        // Validate slug: lowercase alphanumeric + hyphens
        if (!/^[a-z0-9-]+$/.test(slug)) {
            return apiError("Slug may only contain lowercase letters, numbers, and hyphens", 400);
        }

        const passwordHash = await hashPassword(password);

        // Create tenant + clinic owner in a single transaction
        const result = await prisma.$transaction(async (tx: any) => {
            const tenant = await tx.tenant.create({
                data: {
                    name: clinicName,
                    slug,
                    email: email || ownerEmail,
                    phone: phone || null,
                    address: address || null,
                    timezone,
                },
            });

            // Seed default working hours (Mon–Fri 8am–5pm)
            await tx.tenantSettings.create({
                data: {
                    tenantId: tenant.id,
                    hoursOfOperation: {
                        monday:    { open: "08:00", close: "17:00", isOpen: true },
                        tuesday:   { open: "08:00", close: "17:00", isOpen: true },
                        wednesday: { open: "08:00", close: "17:00", isOpen: true },
                        thursday:  { open: "08:00", close: "17:00", isOpen: true },
                        friday:    { open: "08:00", close: "17:00", isOpen: true },
                        saturday:  { open: "09:00", close: "13:00", isOpen: false },
                        sunday:    { open: "09:00", close: "13:00", isOpen: false },
                    },
                },
            });

            // Seed empty content
            await tx.tenantContent.create({
                data: {
                    tenantId: tenant.id,
                    aboutPage: `Welcome to ${clinicName}. We are committed to providing exceptional dental care.`,
                },
            });

            const owner = await tx.user.create({
                data: {
                    tenantId: tenant.id,
                    firstName: ownerFirstName,
                    lastName: ownerLastName,
                    email: ownerEmail,
                    phone: ownerPhone || null,
                    passwordHash,
                    roles: {
                        create: [{ systemRole: "CLINIC_OWNER" }],
                    },
                },
            });

            return { tenant, owner };
        });

        // Issue JWT so the clinic owner is immediately logged in
        const token = signToken({
            userId: result.owner.id,
            type: "STAFF",
            role: "CLINIC_OWNER",
            roles: ["CLINIC_OWNER"],
            tenantId: result.tenant.id,
            permissions: [],
            featureFlags: [],
        });

        const response = apiSuccess({
            tenant: { id: result.tenant.id, name: result.tenant.name, slug: result.tenant.slug },
            user:   { id: result.owner.id, firstName: result.owner.firstName, lastName: result.owner.lastName },
        }, 201);

        response.headers.set(
            "Set-Cookie",
            `nexus_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`
        );

        return response;
    } catch (error: unknown) {
        console.error("[Onboarding] Error:", error);
        return apiError("Internal server error", 500);
    }
}

// GET /api/onboarding/check-slug?slug=xxx — check slug availability
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    if (!slug) return apiError("slug is required", 400);
    if (!/^[a-z0-9-]+$/.test(slug)) return apiSuccess({ available: false, reason: "Invalid characters" });
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    return apiSuccess({ available: !existing });
}
