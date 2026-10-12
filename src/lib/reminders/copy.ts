// ============================================
// NEXUS DENTAL — Reminder message text
// Short, one SMS segment where possible, no reply-to-cancel promise (no inbound
// SMS workflow exists), no patient surname.
// ============================================

/** `minutesUntil` is measured at SEND time, so a reminder that fires late never says "in an hour" when it is not. */
export function reminderMessage(input: { firstName: string; clinicName: string; doctorLastName: string; time: string; minutesUntil: number }): string {
    const m = Math.max(1, Math.round(input.minutesUntil));
    const when = m >= 90 ? `in about ${Math.round(m / 60)} hours` : m >= 55 && m <= 65 ? "in about an hour" : `in about ${m} minutes`;
    const first = input.firstName.trim().split(/\s+/)[0] || "there";
    return `Hi ${first}, reminder from ${input.clinicName}: your appointment with Dr ${input.doctorLastName} is ${when}, at ${input.time}. Please arrive 10 minutes early.`;
}
