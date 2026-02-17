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
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
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
        pathname.startsWith("/patients")
    ) {
        const token = request.cookies.get("nexus_token")?.value;
        if (!token) {
            // Check if it's a patient route or staff route
            const isPatientRoute = pathname.startsWith("/portal");
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
