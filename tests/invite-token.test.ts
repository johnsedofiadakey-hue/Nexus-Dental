import { describe, expect, it } from "vitest";
import { generateInviteToken, hashInviteToken, inviteTokenLookupValues, INVITE_TOKEN_PREFIX } from "@/lib/auth/invite-token";

describe("invite tokens", () => {
    it("generates long, unique, hex tokens", () => {
        const a = generateInviteToken();
        const b = generateInviteToken();
        expect(a).toMatch(/^[a-f0-9]{64}$/);
        expect(a).not.toBe(b);
    });

    it("stores a prefixed hash that does not contain the token", () => {
        const raw = generateInviteToken();
        const stored = hashInviteToken(raw);
        expect(stored.startsWith(INVITE_TOKEN_PREFIX)).toBe(true);
        expect(stored).not.toContain(raw);
        expect(hashInviteToken(raw)).toBe(stored); // deterministic
    });

    it("matches the hashed row and, for old rows, the raw token", () => {
        const raw = "legacy-raw-token-abc";
        expect(inviteTokenLookupValues(raw)).toEqual([hashInviteToken(raw), raw]);
    });

    it("does NOT let a stored hash be presented as if it were the token", () => {
        const stored = hashInviteToken(generateInviteToken());
        const values = inviteTokenLookupValues(stored);
        expect(values).not.toContain(stored); // the raw-compare path is closed for hash-shaped input
        expect(values).toEqual([hashInviteToken(stored)]);
    });

    it("refuses empty and oversized input", () => {
        expect(inviteTokenLookupValues("")).toEqual([]);
        expect(inviteTokenLookupValues("x".repeat(201))).toEqual([]);
    });
});
