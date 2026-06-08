// ============================================
// NEXUS DENTAL — Next.js Edge Middleware
// Global route protection & maintenance mode
// ============================================

import { NextRequest, NextResponse } from "next/server";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
    "/",
    "/services",
    "/booking",
    "/about",
    "/contact",
    "/consultation",
    "/privacy",
    "/terms",
    "/accessibility",
    "/auth/patient",
    "/auth/staff",
];

const PUBLIC_API_ROUTES = [
    "/api/auth/login",
    "/api/auth/patient/otp/request",
    "/api/auth/patient/otp/verify",
    "/api/appointments/doctors",
    "/api/appointments/slots",
    "/api/appointments/book",
    "/api/services",
    "/api/public",
];

// Static file extensions to skip
const STATIC_EXTENSIONS = [
    ".ico",
    ".png",
    ".jpg",
    ".jpeg",
    ".svg",
    ".gif",
    ".webp",
    ".css",
    ".js",
    ".woff",
    ".woff2",
    ".ttf",
];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip static files and Next.js internals
    if (
        pathname.startsWith("/_next") ||
        STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext))
    ) {
        return NextResponse.next();
    }

    // Allow public marketing routes
    if (PUBLIC_ROUTES.includes(pathname)) {
        return NextResponse.next();
    }

    // Allow public API routes
    if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // For API routes, check for Authorization header
    if (pathname.startsWith("/api/")) {
        const authHeader = request.headers.get("authorization");
        const cookieToken = request.cookies.get("nexus_token")?.value || request.cookies.get("nexus_patient_token")?.value;
        if ((!authHeader || !authHeader.startsWith("Bearer ")) && !cookieToken) {
            return NextResponse.json(
                { success: false, error: "Authentication required" },
                { status: 401 }
            );
        }
        // Detailed JWT verification happens in route handlers
        return NextResponse.next();
    }

    // For protected pages (dashboard, admin, etc.)
    // Check for auth token in cookies or redirect to login
    if (
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/system") ||
        pathname.startsWith("/portal") ||
        pathname.startsWith("/clinical") ||
        pathname.startsWith("/finance") ||
        pathname.startsWith("/inventory") ||
        pathname.startsWith("/appointments") ||
        pathname.startsWith("/patients") ||
        pathname.startsWith("/dental-chart") ||
        pathname.startsWith("/treatment-plans") ||
        pathname.startsWith("/lab-orders") ||
        pathname.startsWith("/consent") ||
        pathname.startsWith("/clinic-services") ||
        pathname.startsWith("/pharmacy") ||
        pathname.startsWith("/suppliers") ||
        pathname.startsWith("/expenses") ||
        pathname.startsWith("/waitlist") ||
        pathname.startsWith("/insurance") ||
        pathname.startsWith("/analytics") ||
        pathname.startsWith("/reviews") ||
        pathname.startsWith("/content") ||
        pathname.startsWith("/support") ||
        pathname.startsWith("/doctor")
    ) {
        const isPatientRoute = pathname.startsWith("/portal");
        const token = isPatientRoute 
            ? request.cookies.get("nexus_patient_token")?.value 
            : request.cookies.get("nexus_token")?.value;

        if (!token) {
            const loginPath = isPatientRoute ? "/auth/patient" : "/auth/staff";
            const loginUrl = new URL(loginPath, request.url);
            loginUrl.searchParams.set("redirect", pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    // Run middleware on all routes except static assets
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};
