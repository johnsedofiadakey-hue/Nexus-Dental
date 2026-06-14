import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { InsuranceService } from "@/lib/services/insurance.service";

/**
 * GET /api/insurance/estimate
 * Get estimated reimbursement for an invoice amount
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;

    const body = await request.json();
    const { provider, invoiceAmount, coveragePercentage } = body;

    if (!provider || !invoiceAmount) {
      return apiError("provider and invoiceAmount are required", 400);
    }

    if (typeof invoiceAmount !== "number" || invoiceAmount <= 0) {
      return apiError("invoiceAmount must be a positive number", 400);
    }

    const estimate = InsuranceService.calculateEstimatedReimbursement(
      provider,
      invoiceAmount,
      coveragePercentage ? coveragePercentage / 100 : undefined
    );

    if (!estimate.provider) {
      return apiError("Insurance provider not found", 404);
    }

    // Patient's out-of-pocket cost (before insurance approval)
    const patientOutOfPocket = invoiceAmount - estimate.estimatedReimbursement;

    return apiSuccess({
      invoiceAmount: parseFloat(invoiceAmount.toFixed(2)),
      provider: estimate.provider.name,
      estimatedReimbursement: estimate.estimatedReimbursement,
      estimatedApprovalRate: estimate.estimatedApprovalRate,
      estimatedPatientOutOfPocket: parseFloat(patientOutOfPocket.toFixed(2)),
      estimatedDaysToReceive: estimate.estimatedDaysToReceive,
      disclaimer: estimate.note,
      note: "This is an estimate. Actual reimbursement depends on insurance approval and any exclusions.",
    });
  } catch (error: any) {
    console.error("[Insurance Estimate API] Error:", error);
    return apiError("Failed to calculate estimate", 500);
  }
}
