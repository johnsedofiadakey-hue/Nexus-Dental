import { onboardingDisabledResponse } from "@/lib/config/guards";

// ============================================
// Browser self-registration is RETIRED.
//
// The previous implementation let whoever reached this URL first create the
// clinic and become its owner, racing the real operator, and issued a
// permission-empty owner session. Clinics are now created offline and
// idempotently by an operator:
//
//   npm run clinic:provision -- --manifest clients/<clinic>/clinic.yaml ...
//
// See docs/CLINIC_PROVISIONING.md. Both methods answer 410 in every
// environment and mode — this endpoint is not conditionally open.
// ============================================

export async function POST() {
    return onboardingDisabledResponse();
}

export async function GET() {
    return onboardingDisabledResponse();
}
