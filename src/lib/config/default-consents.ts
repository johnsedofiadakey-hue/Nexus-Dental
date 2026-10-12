// ============================================
// NEXUS DENTAL — Default consent templates created for every new clinic.
//
// Templates are created only when missing and are never overwritten afterwards,
// so a clinic can edit its own wording without a re-provision undoing it.
//
// The wording is STARTER TEXT. It must be reviewed by the clinic (and its legal
// adviser) before real patients sign it.
// ============================================

export interface DefaultConsentTemplate {
    /** Fixed id so re-provisioning finds the same row instead of duplicating it. */
    id: string;
    title: string;
    category: string;
    content: string;
}

export const DEFAULT_CONSENT_TEMPLATES: readonly DefaultConsentTemplate[] = [
    {
        id: "global-telehealth-consent",
        title: "Telehealth Consultation Consent",
        category: "telehealth",
        content: `TELEHEALTH CONSULTATION CONSENT FORM

I understand that I am participating in a virtual telehealth consultation with a licensed healthcare provider.

KEY LIMITATIONS OF TELEHEALTH:
- Visual examination may be limited compared to in-person visits
- Physical examination may not be possible
- Some conditions may require in-person evaluation

TECHNICAL REQUIREMENTS:
- I have a stable internet connection
- I have access to a private, quiet location
- I understand that technical difficulties may interrupt the consultation

PRIVACY & CONFIDENTIALITY:
- This consultation will be conducted privately between me and the healthcare provider
- My health information is confidential and is handled in line with Ghana's Data Protection Act, 2012 (Act 843)
- I will not share the consultation link with unauthorized individuals

CONSENT TO RECORDING (Optional):
- I understand that this consultation may be recorded for quality assurance and training
- Recordings will be stored securely and accessed only by authorized personnel
- I may revoke recording consent at any time by stating so during the consultation

By clicking "I Agree", I confirm that:
1. I understand the limitations and risks of telehealth
2. I am in a suitable location for this consultation
3. I provide informed consent for this telehealth consultation
4. I agree to maintain privacy and confidentiality`,
    },
];
