// ============================================
// NEXUS DENTAL — Insurance Service (Ghana)
// NHIS, VDRL, Hygeia, AXA, Glico, ALICO integration
// ============================================

export interface InsuranceProvider {
  id: string;
  name: string;
  type: "NHIS" | "PRIVATE";
  claimsTurnaroundDays: number;
  reimbursementRate: number; // percentage
  contactInfo?: {
    phone?: string;
    email?: string;
    portal?: string;
  };
}

export interface PatientInsuranceProfile {
  id: string;
  patientId: string;
  tenantId: string;
  provider: string;
  policyNumber: string;
  holderName: string;
  relationship: "SELF" | "SPOUSE" | "CHILD" | "PARENT" | "OTHER";
  coverageType: "IN_PATIENT" | "OUT_PATIENT" | "BOTH";
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  expiresAt?: Date;
  maxClaimPerYear?: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsuranceClaim {
  id: string;
  tenantId: string;
  invoiceId: string;
  provider: string;
  policyNumber: string;
  claimedAmount: number;
  approvedAmount?: number;
  status: "SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED" | "PARTIAL";
  submittedAt: Date;
  approvedAt?: Date;
  rejectionReason?: string;
  claimReference?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const GHANA_INSURERS: Record<string, InsuranceProvider> = {
  NHIS: {
    id: "NHIS",
    name: "National Health Insurance Scheme",
    type: "NHIS",
    claimsTurnaroundDays: 10,
    reimbursementRate: 0.9,
    contactInfo: {
      phone: "+233 800 901 900",
      portal: "https://claims.nhis.gov.gh",
    },
  },
  VDRL: {
    id: "VDRL",
    name: "VDRL Insurance (Ghana)",
    type: "PRIVATE",
    claimsTurnaroundDays: 5,
    reimbursementRate: 0.85,
    contactInfo: {
      phone: "+233 30 276 2000",
      email: "claims@vdrlinsurance.com.gh",
    },
  },
  HYGEIA: {
    id: "HYGEIA",
    name: "Hygeia Insurance Ghana",
    type: "PRIVATE",
    claimsTurnaroundDays: 7,
    reimbursementRate: 0.8,
    contactInfo: {
      phone: "+233 30 295 5000",
      email: "claims@hygeiainsurance.com.gh",
    },
  },
  AXA: {
    id: "AXA",
    name: "AXA Mansard Insurance Ghana",
    type: "PRIVATE",
    claimsTurnaroundDays: 7,
    reimbursementRate: 0.82,
    contactInfo: {
      phone: "+233 30 2665 000",
      email: "claims@axa.com.gh",
    },
  },
  GLICO: {
    id: "GLICO",
    name: "Ghana National Petroleum Corporation Insurance",
    type: "PRIVATE",
    claimsTurnaroundDays: 8,
    reimbursementRate: 0.8,
    contactInfo: {
      phone: "+233 30 274 2500",
      email: "claims@glico.com.gh",
    },
  },
  ALICO: {
    id: "ALICO",
    name: "ALICO Insurance Ghana",
    type: "PRIVATE",
    claimsTurnaroundDays: 7,
    reimbursementRate: 0.8,
    contactInfo: {
      phone: "+233 30 231 6780",
      email: "claims@alicoinsurance.com.gh",
    },
  },
  ARK: {
    id: "ARK",
    name: "Ark Foundation Ghana",
    type: "PRIVATE",
    claimsTurnaroundDays: 10,
    reimbursementRate: 0.75,
    contactInfo: {
      phone: "+233 30 221 4000",
      email: "claims@arkfoundation.com.gh",
    },
  },
};

export class InsuranceService {
  /**
   * Get all available insurance providers in Ghana
   */
  static getAllProviders(): InsuranceProvider[] {
    return Object.values(GHANA_INSURERS);
  }

  /**
   * Get specific provider details
   */
  static getProvider(providerId: string): InsuranceProvider | null {
    return GHANA_INSURERS[providerId] || null;
  }

  /**
   * Verify NHIS membership manually (since NHIS has no API)
   * In production, clinic staff would call NHIS hotline or use their portal
   */
  static async verifyNHISMembership(
    policyNumber: string,
    patientName: string
  ): Promise<{
    isValid: boolean;
    message: string;
    expiryDate?: Date;
  }> {
    // NHIS format: 10-digit policy number starting with GH
    const nhisPattern = /^GH\d{8}$/;

    if (!nhisPattern.test(policyNumber)) {
      return {
        isValid: false,
        message: "Invalid NHIS format. Expected: GH + 8 digits (e.g., GH12345678)",
      };
    }

    // In production, this would call NHIS API via web service
    // For now, we return a valid response that clinic staff must verify
    return {
      isValid: true,
      message: "NHIS policy format is valid. Verify with NHIS portal or hotline: +233 800 901 900",
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Assume 1 year validity
    };
  }

  /**
   * Verify private insurance eligibility
   * Most private insurers don't have public verification APIs
   * Clinics must verify by calling the insurer directly
   */
  static getEligibilityVerificationGuide(providerId: string): {
    provider: InsuranceProvider | null;
    verificationMethod: string;
    requiredDocuments: string[];
    estimatedTime: string;
  } {
    const provider = GHANA_INSURERS[providerId];

    if (!provider) {
      return {
        provider: null,
        verificationMethod: "Unknown provider",
        requiredDocuments: [],
        estimatedTime: "N/A",
      };
    }

    return {
      provider,
      verificationMethod: `Call ${provider.contactInfo?.phone || "insurer"} or visit their portal`,
      requiredDocuments: [
        "Patient ID (National ID, Passport, or Insurance Card)",
        "Insurance Policy Number",
        "Coverage details (if available)",
      ],
      estimatedTime: "5-15 minutes over phone",
    };
  }

  /**
   * Calculate estimated reimbursement for an invoice
   */
  static calculateEstimatedReimbursement(
    providerId: string,
    invoiceAmount: number,
    coveragePercentage?: number
  ): {
    provider: InsuranceProvider | null;
    estimatedApprovalRate: number;
    estimatedReimbursement: number;
    estimatedDaysToReceive: number;
    note: string;
  } {
    const provider = GHANA_INSURERS[providerId];

    if (!provider) {
      return {
        provider: null,
        estimatedApprovalRate: 0,
        estimatedReimbursement: 0,
        estimatedDaysToReceive: 0,
        note: "Provider not found",
      };
    }

    const approvalRate = coveragePercentage ?? provider.reimbursementRate;
    const estimatedReimbursement = invoiceAmount * approvalRate;

    return {
      provider,
      estimatedApprovalRate: Math.round(approvalRate * 100),
      estimatedReimbursement: Math.round(estimatedReimbursement * 100) / 100,
      estimatedDaysToReceive: provider.claimsTurnaroundDays,
      note: `${provider.name} typically approves and reimburses within ${provider.claimsTurnaroundDays} business days. This is an estimate only.`,
    };
  }

  /**
   * Generate claim submission guide for clinic staff
   */
  static getClaimSubmissionGuide(providerId: string): string {
    const provider = GHANA_INSURERS[providerId];

    if (!provider) {
      return "Provider not found";
    }

    const guide = `
CLAIM SUBMISSION GUIDE - ${provider.name}

1. REQUIRED DOCUMENTS:
   - Patient's insurance card or policy number
   - Invoice/Receipt
   - Prescription (if applicable)
   - Medical reports/diagnosis
   - Hospital/Clinic receipt with stamp and signature

2. SUBMISSION METHOD:
   ${provider.type === "NHIS"
     ? `- Visit NHIS portal: ${provider.contactInfo?.portal || "https://claims.nhis.gov.gh"}
   - Call NHIS: ${provider.contactInfo?.phone || "N/A"}
   - Visit nearest NHIS office`
     : `- Call: ${provider.contactInfo?.phone || "N/A"}
   - Email: ${provider.contactInfo?.email || "N/A"}
   - Visit insurer's office`
    }

3. TURNAROUND TIME:
   - Expected processing: ${provider.claimsTurnaroundDays} business days
   - Reimbursement rate: ${Math.round(provider.reimbursementRate * 100)}%

4. FOLLOW UP:
   - Keep claim reference number
   - Follow up after 7 days if no response
   - Contact ${provider.contactInfo?.phone || "the insurer"} for status

5. REQUIRED INFO FOR SUBMISSION:
   - Patient name and ID
   - Policy number
   - Date of service
   - Service description
   - Amount claimed
   - Doctor's name and credentials
    `;

    return guide;
  }

  /**
   * Sync insurance claim status from provider to system
   * In production, this would integrate with insurer APIs if available
   */
  static async syncClaimStatus(
    claimId: string,
    providerId: string,
    policyNumber: string
  ): Promise<{
    status: "SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED" | "PARTIAL";
    message: string;
    approvedAmount?: number;
    rejectionReason?: string;
  }> {
    // For Ghana insurers without APIs, claims must be tracked manually
    // This function would be enhanced when insurers provide API access

    return {
      status: "PENDING",
      message: `Claim status for ${providerId} can only be checked by calling the insurer directly.`,
      rejectionReason: "Manual tracking required - no API integration available",
    };
  }
}
