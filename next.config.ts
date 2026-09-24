import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Baseline security headers applied to every response.
// CSP is intentionally not set yet: it needs a nonce-based policy tested against
// Firebase Auth (reCAPTCHA), Sentry, Daily and Paystack before it can be enforced
// without breaking sign-in or payments. Tracked as a follow-up in the hardening plan.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "ioredis", "bcryptjs"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Source-map upload only runs when SENTRY_AUTH_TOKEN is set (CI/production
// build) — without it this just passes the config through unchanged, so
// local dev and builds without Sentry configured aren't affected.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
