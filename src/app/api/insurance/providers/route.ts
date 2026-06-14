import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { InsuranceService } from "@/lib/services/insurance.service";

/**
 * GET /api/insurance/providers
 * Get list of available insurance providers in Ghana
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // NHIS or PRIVATE

    const allProviders = InsuranceService.getAllProviders();

    let providers = allProviders;
    if (type) {
      providers = allProviders.filter((p) => p.type === type);
    }

    return apiSuccess({
      total: providers.length,
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        reimbursementRate: Math.round(p.reimbursementRate * 100),
        claimsTurnaroundDays: p.claimsTurnaroundDays,
        contact: p.contactInfo,
      })),
    });
  } catch (error: any) {
    console.error("[Insurance Providers API] Error:", error);
    return apiError("Failed to fetch providers", 500);
  }
}
