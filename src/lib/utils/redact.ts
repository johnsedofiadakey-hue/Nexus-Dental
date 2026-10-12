// ============================================
// NEXUS DENTAL — Redaction for anything that may be logged or stored
// Dependency-free so any layer can use it.
// ============================================

/** Remove URLs, emails, phone numbers and token-looking strings, and cap the length. */
export function redactText(message: string, max = 500): string {
    return message
        .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s'"]+/gi, "<url>")
        .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<email>")
        .replace(/\+?\d[\d\s().-]{6,}\d/g, "<number>")
        .replace(/\b(?:eyJ[\w-]{10,}|[A-Za-z0-9_-]{32,})\b/g, "<token>")
        .slice(0, max);
}
