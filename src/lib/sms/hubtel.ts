// ============================================
// NEXUS DENTAL — Hubtel SMS + WhatsApp Service
// Supports Ghana-first phone number formatting
// ============================================

const HUBTEL_SMS_URL = "https://smsc.hubtel.com/v1/messages/send";
const HUBTEL_WHATSAPP_URL = "https://api.hubtel.com/v1/whatsapp/messages";

// ─── Phone number normalisation ───────────────────────────────────────────────

/**
 * Strip non-digits and ensure the number starts with a full country code.
 * Defaults to Ghana (+233) if the number has no leading country code.
 *
 * Examples:
 *   "0244123456"   → "233244123456"
 *   "+233244123456"→ "233244123456"
 *   "44 7911 123456"→ "447911123456"
 */
function normalisePhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");

    // Already has a full country code (9+ digits not starting with 0)
    if (digits.length >= 10 && !digits.startsWith("0")) {
        return digits;
    }

    // Ghanaian local number (starts with 0, 9 or 10 digits)
    if (digits.startsWith("0") && digits.length >= 9) {
        return "233" + digits.slice(1);
    }

    // Fallback: prepend Ghana country code
    return "233" + digits;
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

function getAuthHeader(): string | null {
    const clientId = process.env.HUBTEL_CLIENT_ID;
    const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

// ─── Core send functions ──────────────────────────────────────────────────────

/**
 * Send an SMS via Hubtel.
 * Falls back to console.log when env vars are not configured.
 */
export async function sendSMS(to: string, message: string): Promise<void> {
    const auth = getAuthHeader();
    const phone = normalisePhone(to);

    if (!auth) {
        console.log(`[Hubtel SMS dev] → ${phone}: ${message}`);
        return;
    }

    const senderId = process.env.HUBTEL_SENDER_ID ?? "NexusDental";

    try {
        const res = await fetch(HUBTEL_SMS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: auth,
            },
            body: JSON.stringify({
                From: senderId,
                To: phone,
                Content: message,
            }),
        });

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            console.error(`[Hubtel SMS] HTTP ${res.status} for ${phone}: ${body}`);
        } else {
            console.log(`[Hubtel SMS] Sent to ${phone}`);
        }
    } catch (err) {
        console.error(`[Hubtel SMS] Network error for ${phone}:`, err);
    }
}

/**
 * Send a WhatsApp message via Hubtel.
 * Falls back to console.log when env vars are not configured.
 */
export async function sendWhatsApp(to: string, message: string): Promise<void> {
    const auth = getAuthHeader();
    const phone = normalisePhone(to);

    if (!auth) {
        console.log(`[Hubtel WhatsApp dev] → ${phone}: ${message}`);
        return;
    }

    const from = process.env.HUBTEL_WHATSAPP_NUMBER ?? "";

    try {
        const res = await fetch(HUBTEL_WHATSAPP_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: auth,
            },
            body: JSON.stringify({
                from,
                to: phone,
                body: { type: "text", text: message },
            }),
        });

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            console.error(`[Hubtel WhatsApp] HTTP ${res.status} for ${phone}: ${body}`);
        } else {
            console.log(`[Hubtel WhatsApp] Sent to ${phone}`);
        }
    } catch (err) {
        console.error(`[Hubtel WhatsApp] Network error for ${phone}:`, err);
    }
}

/**
 * Send a notification via one or both channels.
 *
 * @param to       Recipient phone number (any format)
 * @param message  Message text
 * @param channel  'sms' | 'whatsapp' | 'both' — defaults to 'sms'
 */
export async function sendNotification(
    to: string,
    message: string,
    channel: "sms" | "whatsapp" | "both" = "sms"
): Promise<void> {
    const tasks: Promise<void>[] = [];

    if (channel === "sms" || channel === "both") {
        tasks.push(sendSMS(to, message));
    }
    if (channel === "whatsapp" || channel === "both") {
        tasks.push(sendWhatsApp(to, message));
    }

    await Promise.all(tasks);
}

// ─── Message templates ────────────────────────────────────────────────────────

export function appointmentReminder(
    patientName: string,
    date: string,
    time: string,
    clinicName: string,
    doctorName: string
): string {
    return (
        `Hi ${patientName}, this is a reminder from ${clinicName}. ` +
        `Your appointment with Dr. ${doctorName} is scheduled for ${date} at ${time}. ` +
        `Please arrive 10 minutes early. Reply CANCEL to cancel.`
    );
}

export function appointmentConfirmation(
    patientName: string,
    date: string,
    time: string,
    clinicName: string
): string {
    return (
        `Hi ${patientName}, your appointment at ${clinicName} on ${date} at ${time} ` +
        `is confirmed. See you soon!`
    );
}

export function appointmentCancellation(
    patientName: string,
    date: string,
    time: string,
    clinicName: string
): string {
    return (
        `Hi ${patientName}, your appointment at ${clinicName} scheduled for ` +
        `${date} at ${time} has been cancelled. Contact us to reschedule.`
    );
}

export function recallMessage(
    patientName: string,
    clinicName: string,
    phone: string
): string {
    return (
        `Hi ${patientName}, it's been a while since your last visit to ${clinicName}. ` +
        `Regular check-ups keep your smile healthy! Book your appointment today by calling ${phone}.`
    );
}

export function labOrderReady(patientName: string, clinicName: string): string {
    return (
        `Hi ${patientName}, good news! Your lab results are ready at ${clinicName}. ` +
        `Please contact us to arrange collection or your next appointment.`
    );
}

export function invoicePaymentReceived(
    patientName: string,
    amount: string,
    clinicName: string
): string {
    return (
        `Hi ${patientName}, ${clinicName} has received your payment of ${amount}. ` +
        `Thank you! Keep this message as your receipt confirmation.`
    );
}

export function waitlistNotification(
    patientName: string,
    serviceName: string,
    clinicName: string
): string {
    return (
        `Hi ${patientName}, great news! A slot for "${serviceName}" at ${clinicName} ` +
        `is now available. Reply YES to confirm your spot or call us immediately.`
    );
}
