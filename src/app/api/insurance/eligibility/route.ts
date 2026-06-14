import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { getTenantIdFromUser } from "@/lib/clinic";
import { InsuranceService } from "@/lib/services/insurance.service";
import prisma from "@/lib/db/prisma";
import type { JWTPayload } from "@/lib/auth";

/**
 * POST /api/insurance/eligibility
 * Verify a patient's insurance eligibility
 * Ghana: Manual verification guide since NHIS/private insurers have no APIs
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const user = authResult.user as any;
    const tenantId = getTenantIdFromUser(user);

    const body = await request.json();
    const { patientId, provider, policyNumber } = body;

    if (!patientId || !provider || !policyNumber) {
      return apiError("patientId, provider, and policyNumber are required", 400);
    }

    // Verify patient exists
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });

    if (!patient) {
      return apiError("Patient not found", 404);
    }

    // Get provider info
    const providerInfo = InsuranceService.getProvider(provider);
    if (!providerInfo) {
      return apiError("Insurance provider not found", 404);
    }

    // For NHIS, validate format
    let verificationResult;
    if (provider === "NHIS") {
      verificationResult = await InsuranceService.verifyNHISMembership(
        policyNumber,
        `${patient.firstName} ${patient.lastName}`
      );
    } else {
      // For private insurers, return verification guide
      const guide = InsuranceService.getEligibilityVerificationGuide(provider);
      verificationResult = {
        isValid: null, // Cannot auto-verify
        message: guide.verificationMethod,
        guide,
      };
    }

    // Save or update patient insurance profile
    const insuranceProfile = await prisma.patient.update({
      where: { id: patientId },
      data: {
        insuranceProvider: provider,
        insurancePolicyNo: policyNumber,
      },
    });

    return apiSuccess(
      {
        patientId,
        provider,
        policyNumber,
        eligibilityStatus: verificationResult.isValid === true ? "VERIFIED" : "PENDING_VERIFICATION",
        verificationDetails: verificationResult,
        providerInfo: {
          name: providerInfo.name,
          type: providerInfo.type,
          reimbursementRate: Math.round(providerInfo.reimbursementRate * 100),
          expectedTurnaroundDays: providerInfo.claimsTurnaroundDays,
          contact: providerInfo.contactInfo,
        },
        nextStep:
          verificationResult.isValid === true
            ? "Ready to submit claims"
            : "Staff must verify eligibility by calling insurer",
      },
      201
    );
  } catch (error: any) {
    console.error("[Insurance Eligibility API] Error:", error);
    return apiError(error.message || "Failed to verify eligibility", 500);
  }
}

/**
 * GET /api/insurance/eligibility
 * Check eligibility status for a patient
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const user = authResult.user as any;
    const tenantId = getTenantIdFromUser(user);

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return apiError("patientId is required", 400);
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        insuranceProvider: true,
        insurancePolicyNo: true,
      },
    });

    if (!patient) {
      return apiError("Patient not found", 404);
    }

    if (!patient.insuranceProvider) {
      return apiSuccess({
        patientId,
        hasInsurance: false,
        message: "No insurance on file",
      });
    }

    const provider = InsuranceService.getProvider(patient.insuranceProvider);
    const reimbursementEst = InsuranceService.calculateEstimatedReimbursement(
      patient.insuranceProvider,
      0
    );

    return apiSuccess({
      patientId,
      hasInsurance: true,
      provider: patient.insuranceProvider,
      policyNumber: patient.insurancePolicyNo,
      providerDetails: {
        name: provider?.name,
        type: provider?.type,
        reimbursementRate: reimbursementEst.estimatedApprovalRate,
        contactInfo: provider?.contactInfo,
      },
    });
  } catch (error: any) {
    console.error("[Insurance Eligibility API] GET Error:", error);
    return apiError("Failed to fetch eligibility", 500);
  }
}
