// ─────────────────────────────────────────────────────────────
// Nexus Dental — Email Sender
//
// Uses Resend (https://resend.com) — the simplest transactional
// email API. Add to .env.local:
//   RESEND_API_KEY=re_xxxxxxxxxxxx
//   EMAIL_FROM=noreply@yourdomain.com
//
// If RESEND_API_KEY is not set, emails are logged to the console
// (dev mode). No SDK dependency — plain fetch.
// ─────────────────────────────────────────────────────────────

const RESEND_API = "https://api.resend.com/emails";

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
    from?: string;
}

export async function sendEmail({ to, subject, html, from }: SendEmailParams): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const fromAddr = from ?? process.env.EMAIL_FROM ?? "Nexus Dental <noreply@nexusdental.app>";

    if (!apiKey) {
        // Dev fallback — log to console
        console.log("\n─── [EMAIL DEV LOG] ───────────────────────────────");
        console.log(`To:      ${to}`);
        console.log(`From:    ${fromAddr}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body:\n${html.replace(/<[^>]+>/g, "").trim().slice(0, 500)}`);
        console.log("───────────────────────────────────────────────────\n");
        return;
    }

    const res = await fetch(RESEND_API, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: fromAddr, to, subject, html }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Email send failed: ${err.message ?? res.statusText}`);
    }
}

// ─── Templates ───────────────────────────────────────────────

export function staffInviteEmailHtml(params: {
    clinicName: string;
    inviterName: string;
    role: string;
    acceptUrl: string;
    expiresHours: number;
}): string {
    const roleLabel = params.role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="background:#0d9488;padding:32px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-block;text-align:center;line-height:40px;font-weight:700;color:#fff;font-size:14px;">ND</div>
              <span style="color:#fff;font-size:20px;font-weight:700;vertical-align:middle;">Nexus Dental</span>
            </div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;">You're invited to join ${params.clinicName}</h1>
            <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
              <strong style="color:#0f172a;">${params.inviterName}</strong> has invited you to join <strong style="color:#0f172a;">${params.clinicName}</strong> as a <strong style="color:#0d9488;">${roleLabel}</strong>.
            </p>
            <p style="margin:0 0 32px;color:#64748b;font-size:14px;line-height:1.6;">
              Click the button below to accept your invitation and set up your account using your Google account. This link expires in <strong>${params.expiresHours} hours</strong>.
            </p>
            <div style="text-align:center;margin-bottom:32px;">
              <a href="${params.acceptUrl}"
                 style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:16px;">
                Accept Invitation →
              </a>
            </div>
            <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
              If you weren't expecting this invitation, you can safely ignore this email.<br>
              This link will expire in ${params.expiresHours} hours.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f1f5f9;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">Nexus Dental · Authorized Personnel Only</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
