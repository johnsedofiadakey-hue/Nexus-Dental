// ============================================
// NEXUS DENTAL — Invitation tokens
//
// An invitation link carries a random token that is a one-time credential for
// creating an account. Only a hash of it is stored, so a database leak or
// backup cannot be turned into working invitation links.
//
// Stored form: "sha256:<hex digest of the raw token>".
// ============================================

import crypto from "crypto";

export const INVITE_TOKEN_PREFIX = "sha256:";
const MAX_PRESENTED_LENGTH = 200;

/** A new random token to put in the emailed link. Never store this value. */
export function generateInviteToken(): string {
    return crypto.randomBytes(32).toString("hex");
}

/** The value stored in staff_invites.token for a raw token. */
export function hashInviteToken(raw: string): string {
    return INVITE_TOKEN_PREFIX + crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Column values a presented token may legitimately match.
 *
 * Always the hashed form. Rows created before hashing existed hold the raw
 * token, so the raw value is also accepted — but ONLY when it could not itself
 * be a stored hash. Otherwise someone who read the database could present a
 * stored hash and have it accepted as if it were the token.
 */
export function inviteTokenLookupValues(presented: string): string[] {
    if (!presented || presented.length > MAX_PRESENTED_LENGTH) return [];
    const values = [hashInviteToken(presented)];
    if (!presented.startsWith(INVITE_TOKEN_PREFIX)) values.push(presented);
    return values;
}
