// ============================================
// NEXUS DENTAL — Support Triage Engine
// Auto-detect severity, keyword matching, escalation
// ============================================

import { EMERGENCY_KEYWORDS } from "@/lib/auth/types";

export type TriageSeverity = "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY";

export interface TriageResult {
    severity: TriageSeverity;
    matchedKeywords: string[];
    shouldAutoEscalate: boolean;
    suggestedIssueType: string;
    responseTimeMinutes: number;
}

// Keywords mapped to severity and issue types
const SEVERITY_KEYWORDS: Record<
    string,
    { severity: TriageSeverity; issueType: string }
> = {
    // Emergency
    bleeding: { severity: "EMERGENCY", issueType: "EMERGENCY" },
    "severe pain": { severity: "EMERGENCY", issueType: "EMERGENCY" },
    swelling: { severity: "EMERGENCY", issueType: "EMERGENCY" },
    "knocked out": { severity: "EMERGENCY", issueType: "EMERGENCY" },
    "broken tooth": { severity: "EMERGENCY", issueType: "EMERGENCY" },
    abscess: { severity: "EMERGENCY", issueType: "EMERGENCY" },
    trauma: { severity: "EMERGENCY", issueType: "EMERGENCY" },
    unbearable: { severity: "EMERGENCY", issueType: "EMERGENCY" },
    "can't stop bleeding": { severity: "EMERGENCY", issueType: "EMERGENCY" },
    "face swollen": { severity: "EMERGENCY", issueType: "EMERGENCY" },

    // High
    "sharp pain": { severity: "HIGH", issueType: "CLINICAL" },
    "tooth pain": { severity: "HIGH", issueType: "CLINICAL" },
    infection: { severity: "HIGH", issueType: "CLINICAL" },
    fever: { severity: "HIGH", issueType: "CLINICAL" },
    "can't eat": { severity: "HIGH", issueType: "CLINICAL" },
    "can't sleep": { severity: "HIGH", issueType: "CLINICAL" },
    "jaw locked": { severity: "HIGH", issueType: "CLINICAL" },

    // Medium
    sensitivity: { severity: "MEDIUM", issueType: "CLINICAL" },
    toothache: { severity: "MEDIUM", issueType: "CLINICAL" },
    "bad breath": { severity: "MEDIUM", issueType: "CLINICAL" },
    "gum bleeding": { severity: "MEDIUM", issueType: "CLINICAL" },
    discomfort: { severity: "MEDIUM", issueType: "CLINICAL" },

    // Billing keywords
    invoice: { severity: "LOW", issueType: "BILLING" },
    payment: { severity: "LOW", issueType: "BILLING" },
    receipt: { severity: "LOW", issueType: "BILLING" },
    refund: { severity: "MEDIUM", issueType: "BILLING" },
    overcharged: { severity: "MEDIUM", issueType: "BILLING" },
    insurance: { severity: "LOW", issueType: "BILLING" },

    // Appointment keywords
    reschedule: { severity: "LOW", issueType: "APPOINTMENT" },
    cancel: { severity: "LOW", issueType: "APPOINTMENT" },
    "change appointment": { severity: "LOW", issueType: "APPOINTMENT" },
    "book appointment": { severity: "LOW", issueType: "APPOINTMENT" },
    "waiting time": { severity: "LOW", issueType: "APPOINTMENT" },

    // General
    feedback: { severity: "LOW", issueType: "GENERAL" },
    complaint: { severity: "MEDIUM", issueType: "GENERAL" },
    suggestion: { severity: "LOW", issueType: "GENERAL" },
    "thank you": { severity: "LOW", issueType: "GENERAL" },
};

// Response time SLA by severity (in minutes)
const RESPONSE_TIME_SLA: Record<TriageSeverity, number> = {
    EMERGENCY: 5,
    HIGH: 30,
    MEDIUM: 120,
    LOW: 480, // 8 hours
};

/**
 * Triage a support ticket based on subject + description.
 *
 * Scans text against keyword database, determines severity,
 * suggests issue type, and calculates response time SLA.
 */
export function triageTicket(
    subject: string,
    description: string
): TriageResult {
    const textToScan = `${subject} ${description}`.toLowerCase();

    const matchedKeywords: string[] = [];
    let highestSeverity: TriageSeverity = "LOW";
    let suggestedIssueType = "GENERAL";

    const severityRank: Record<TriageSeverity, number> = {
        LOW: 0,
        MEDIUM: 1,
        HIGH: 2,
        EMERGENCY: 3,
    };

    // Check emergency keywords first (from auth/types)
    for (const keyword of EMERGENCY_KEYWORDS) {
        if (textToScan.includes(keyword.toLowerCase())) {
            matchedKeywords.push(keyword);
            highestSeverity = "EMERGENCY";
            suggestedIssueType = "EMERGENCY";
        }
    }

    // Check extended keyword database
    for (const [keyword, config] of Object.entries(SEVERITY_KEYWORDS)) {
        if (textToScan.includes(keyword)) {
            if (!matchedKeywords.includes(keyword)) {
                matchedKeywords.push(keyword);
            }
            if (severityRank[config.severity] > severityRank[highestSeverity]) {
                highestSeverity = config.severity;
                suggestedIssueType = config.issueType;
            }
        }
    }

    return {
        severity: highestSeverity,
        matchedKeywords,
        shouldAutoEscalate:
            highestSeverity === "EMERGENCY" || highestSeverity === "HIGH",
        suggestedIssueType,
        responseTimeMinutes: RESPONSE_TIME_SLA[highestSeverity],
    };
}

/**
 * Check if a ticket should be escalated based on:
 * - Severity upgrade
 * - Response time exceeded
 * - Patient follow-up count
 */
export function shouldEscalate(
    severity: TriageSeverity,
    createdAt: Date,
    messageCount: number,
    currentStatus: string
): { escalate: boolean; reason?: string } {
    const now = new Date();
    const elapsedMinutes =
        (now.getTime() - createdAt.getTime()) / (1000 * 60);
    const slaMinutes = RESPONSE_TIME_SLA[severity];

    // SLA breach
    if (
        elapsedMinutes > slaMinutes &&
        currentStatus !== "RESOLVED" &&
        currentStatus !== "CLOSED"
    ) {
        return { escalate: true, reason: `SLA breached: ${Math.round(elapsedMinutes)}min elapsed (SLA: ${slaMinutes}min)` };
    }

    // Too many patient follow-ups without resolution
    if (messageCount >= 5 && currentStatus === "OPEN") {
        return { escalate: true, reason: `${messageCount} messages without resolution` };
    }

    // Emergency tickets in non-escalated status
    if (severity === "EMERGENCY" && currentStatus !== "ESCALATED") {
        return { escalate: true, reason: "Emergency ticket not yet escalated" };
    }

    return { escalate: false };
}
