import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { InsuranceService } from "@/lib/services/insurance.service";

/**
 * GET /api/insurance/submission-guide
 * Get claim submission guide for a specific insurer
 * Used by clinic staff to understand how to submit claims
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return apiError("provider is required", 400);
    }

    const guide = InsuranceService.getClaimSubmissionGuide(provider);
    const providerInfo = InsuranceService.getProvider(provider);

    if (!providerInfo) {
      return apiError("Provider not found", 404);
    }

    return apiSuccess({
      provider,
      providerDetails: {
        name: providerInfo.name,
        type: providerInfo.type,
        contact: providerInfo.contactInfo,
        estimatedTurnaroundDays: providerInfo.claimsTurnaroundDays,
      },
      submissionGuide: guide,
      formattedGuide: {
        requiredDocuments: [
          "Patient insurance card or policy number",
          "Invoice/Receipt",
          "Prescription (if applicable)",
          "Medical reports/diagnosis",
          "Hospital/Clinic receipt with stamp and signature",
        ],
        submissionMethod:
          providerInfo.type === "NHIS"
            ? [
                `Visit NHIS portal: ${providerInfo.contactInfo?.portal || "https://claims.nhis.gov.gh"}`,
                `Call NHIS: ${providerInfo.contactInfo?.phone || "N/A"}`,
                "Visit nearest NHIS office",
              ]
            : [
                `Call: ${providerInfo.contactInfo?.phone || "N/A"}`,
                `Email: ${providerInfo.contactInfo?.email || "N/A"}`,
                "Visit insurer's office",
              ],
        estimatedProcessingTime: `${providerInfo.claimsTurnaroundDays} business days`,
        reimbursementRate: `${Math.round(providerInfo.reimbursementRate * 100)}%`,
      },
    });
  } catch (error: any) {
    console.error("[Insurance Submission Guide API] Error:", error);
    return apiError("Failed to fetch submission guide", 500);
  }
}
