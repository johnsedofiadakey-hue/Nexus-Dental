// ============================================
// NEXUS DENTAL — Sentry client-side init
// Runs in the browser. No-ops safely if NEXT_PUBLIC_SENTRY_DSN isn't set
// (e.g. local dev without a Sentry project configured).
// ============================================

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Session replay is off by default — enable later if it's worth the volume.
    debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
