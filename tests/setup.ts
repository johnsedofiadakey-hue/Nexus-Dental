/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures and database stand-ins are intentionally loosely typed */
// Authority stand-in for the pre-existing route tests.
//
// Those tests sign real tokens and mock the database per file; they predate
// server-side sessions and carry no session row. By default this setup makes the
// session check trust the token's own claims (exactly the old behaviour) so they
// keep testing what they test. Tests that exercise the real session logic set
// `globalThis.__NEXUS_REAL_SESSIONS__ = true` (see tests/helpers/sessions.ts)
// and then hit the genuine `resolveSession` against their own stand-in database.
import { vi } from "vitest";

declare global {
    var __NEXUS_REAL_SESSIONS__: boolean | undefined;
}

vi.mock("@/lib/auth/session", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/auth/session")>();
    return {
        ...actual,
        resolveSession: async (claims: any, now?: Date) => {
            if (globalThis.__NEXUS_REAL_SESSIONS__) return actual.resolveSession(claims, now);
            return { ok: true as const, user: claims, expiresAt: new Date(Date.now() + 3600_000) };
        },
    };
});
