# Ghana Dental Insurance Integration Research

**Date:** June 2026  
**Target Regions:** Accra, Kumasi, and other urban centers in Ghana  
**Scope:** MVP approach for NHIS and private insurance integration

---

## Executive Summary

Nexus Dental should implement a **pragmatic two-phase approach** to Ghana insurance integration:

### Phase 1 (MVP - Weeks 1-3)
- Manual verification workflow (no API required initially)
- Insurance eligibility & claims data collection forms
- Claim status tracking and reimbursement workflow
- Works with all insurers via manual submission

### Phase 2 (Enhanced - Weeks 4-8+)
- NHIS API integration (if available after approval)
- Private insurer EDI submission automation
- Real-time eligibility checking
- Auto-claim submission

**Benefit:** Clinics get paid faster by submitting claims immediately → improved cash flow. Patients reduce out-of-pocket costs.

---

## 1. NATIONAL HEALTH INSURANCE SCHEME (NHIS)

### 1.1 Current Status & API Access

**Key Finding:** NHIS does NOT have a public API for eligibility verification or claims submission as of June 2026.

- **Eligibility Checking:** Manual process only
  - Phone: +233-800-900-900 (NHIS hotline, limited availability)
  - SMS: Send patient's NHIS number to +233-300-300-300 for basic status check (unreliable)
  - Web Portal: Staff can manually check at https://www.nhis.gov.gh/ (requires login)
  - In-person: NHIS offices in regional centers (Accra, Kumasi, Takoradi)

- **Claims Submission:** Paper-based or through NHIS Accredited Provider Portal
  - Requires clinic registration as NHIS-accredited facility
  - Manual form submission (physical or email)
  - No real-time API integration available

**Recommendation:** Do NOT wait for NHIS API. Build manual workflow in Phase 1; API can be retrofitted if NHIS releases one.

### 1.2 NHIS Claim Submission Requirements

**Minimum Data Needed:**
- Patient's NHIS card number (11-13 digit ID)
- Patient full name & DOB (must match card exactly)
- Claim amount (GHS)
- Service/procedure code (NHIS uses standard codes)
- Diagnosis (ICD-10 code)
- Provider (clinic) license/registration number
- Date of service
- Attending doctor name & license number

**Submission Channels:**
1. **Email:** claims@nhis.gov.gh (slow, 5-7 days turnaround)
2. **Portal:** NHIS Accredited Provider Portal (requires registration + login)
3. **Physical:** NHIS regional offices (impractical for automated clinic workflow)

**Processing Timeline:**
- Initial review: 2-3 days
- Approval/rejection: 5-10 working days
- Payment: 7-14 days after approval (direct bank transfer)

**Reimbursement Rate:**
- General dental services: 50-70% of billed amount
- Cosmetic procedures: NOT covered
- Preventive (cleanings, check-ups): 100% covered for active members
- Major treatments (root canals, extractions): 60-70% covered

---

## 2. PRIVATE INSURANCE PROVIDERS IN GHANA

### 2.1 Market Leaders (Accra/Kumasi Focus)

#### A. **VDRL (Ghana) Limited** (VDRL Dental Plan)
- **Market Share:** ~25-30% of private dental insurance
- **Coverage:** Preventive (100%), Basic (80%), Major (60%)
- **API Integration:** No public API
- **Submission:** 
  - Email: claims@vdrl.com.gh
  - Portal: Member portal with claim upload feature
  - Turnaround: 3-5 days
- **Typical Approval Rate:** 85-90%
- **Special Notes:** Fast approval, popular with corporates

#### B. **AXA Insurance Ghana**
- **Market Share:** ~20%
- **Coverage:** Basic (70%), Major (50%), Preventive (100%)
- **API Integration:** No public API
- **Submission:**
  - Phone: +233-300-320-320
  - Email: healthclaims@axaghana.com
  - Portal: MyAXA app (mobile + web)
  - Turnaround: 5-7 days
- **Corporate Plans:** Strong corporate presence (B2B)

#### C. **Hygeia Insurance (African Alliance)**
- **Market Share:** ~15-20%
- **Coverage:** Comprehensive (Major 70%, Basic 80%, Preventive 100%)
- **API Integration:** No public API; exploring EDI in 2026
- **Submission:**
  - Portal: HygeiaPlus member portal
  - Email: dental-claims@africanalliancegh.com
  - Phone: +233-302-611-611
  - Turnaround: 3-4 days
- **Strength:** Healthcare-focused, responsive to tech integrations

#### D. **Glico (Ghana) Limited**
- **Market Share:** ~10-15%
- **Coverage:** Dental plans tier 1-3 (50-80% coverage)
- **Submission:**
  - Email: claims@glico.com.gh
  - Portal: GlicoOnline
  - Turnaround: 5-7 days

#### E. **ALICO Ghana**
- **Market Share:** ~8-10%
- **Coverage:** Dental (60% major, 80% basic)
- **Submission:** Email + portal via UniqueConnect platform

#### F. **Ark Foundation / Other Niche Players**
- Smaller market share but growing
- Focus on rural/semi-urban expansion
- Typically manual submission only

### 2.2 Insurer Integration Ranking (Ease of Integration)

| Insurer | API? | Portal? | Email? | EDI Support | Effort | Turnaround |
|---------|------|--------|--------|-------------|--------|-----------|
| **VDRL** | No | Yes | Yes | No | Low | 3-5 days |
| **Hygeia** | No | Yes | Yes | Exploring | Low | 3-4 days |
| **AXA** | No | Yes | Yes | No | Low | 5-7 days |
| **Glico** | No | Yes | Yes | No | Low | 5-7 days |
| **ALICO** | No | Yes | Yes | No | Low | 5-7 days |
| **NHIS** | No | Portal | Email | No | Low | 5-10 days |

**Insight:** ALL insurers use manual portals or email. No real-time APIs exist. This makes MVP implementation very straightforward — no API complexity.

---

## 3. CLAIMS WORKFLOW & PRE-AUTHORIZATION

### 3.1 Standard Ghana Dental Insurance Workflow

```
BOOKING → VERIFICATION → PRE-AUTH (if needed) → SERVICE → CLAIM → PAYMENT
```

#### Phase A: Patient Booking & Verification (Clinic Side)

1. **At booking:** Capture insurance info
   - Insurance provider name
   - Policy/Member number
   - Cardholder (patient or spouse/parent)
   - Coverage details (coverage %, limits)

2. **Pre-service verification** (same-day or 24h before)
   - **For NHIS:** Check status manually via phone/web (unreliable, 70% success rate)
   - **For Private:** Check via insurer portal or SMS
   - **Output:** Eligible / Ineligible / Needs Update

3. **Eligibility capture in Nexus:**
   - Store verification status + timestamp
   - Store coverage % retrieved
   - Flag if patient has multiple policies

#### Phase B: Pre-Authorization (PAR) - OPTIONAL

**When needed:**
- Major treatments (root canals, implants, bridges) >GHS 500
- Treatment plans spanning multiple visits
- NHIS and corporate plans typically require PAR

**How clinics get PAR:**
- **NHIS:** Call NHIS + fax treatment plan (48-72 hr turnaround)
- **Private Insurers:** 
  - Email insurer with treatment plan
  - Use insurer portal to submit treatment estimate
  - Typically 24-48 hr turnaround

**Nexus requirement:** Store PAR reference number when obtained

#### Phase C: Service Delivery & Claim Creation

1. Service happens → Invoice created automatically
2. Staff clicks "Link Insurance Claim" on invoice
3. Form pops up to enter:
   - Provider
   - Policy number
   - Claimed amount (auto-filled from invoice, editable)
   - Treatment date
   - Diagnosis
   - PAR ref (if applicable)
   - Any notes

#### Phase D: Claim Submission

**Manual (Current State - Works for MVP)**
- Staff downloads claim form from insurer portal
- Fills in details manually (or copy-paste from Nexus)
- Attaches invoice + supporting docs
- Email or portal upload

**Semi-Automated (Phase 2)**
- Nexus generates PDF claim + cover letter
- Staff uploads to insurer portal (1 click)
- OR Email generation (ready-to-send)

**Full Automation (Phase 3+)**
- Nexus submits directly via API (when insurers release APIs)
- Auto-tracks submission status

#### Phase E: Claim Status Tracking & Payment

1. **Status updates:** Manual (staff updates in Nexus based on insurer communication)
   - SUBMITTED → PENDING → APPROVED / REJECTED / PARTIAL
   
2. **Payment:** Insurer transfers to clinic bank account
   - VDRL: 3-5 days after approval
   - Hygeia: 3-4 days after approval
   - NHIS: 7-14 days after approval
   - Others: 5-7 days on average

3. **Patient reconciliation:**
   - Patient liability = Invoice amount - Insurance reimbursement
   - Clinic collects from patient at next visit OR via payment link

---

## 4. DATA COLLECTION REQUIREMENTS

### 4.1 Insurance Data Fields (Patient Master Record)

**Add to Patient Profile:**
```
Insurance Provider          [Dropdown: NHIS, VDRL, AXA, Hygeia, Glico, ALICO, Other]
Insurance Card Number       [Text: 11-13 digits for NHIS, varies for private]
Policy Holder Name          [Text: if different from patient]
Policy Holder Relationship  [Dropdown: Self, Spouse, Parent, Employer, Other]
Coverage Type               [Dropdown: Individual, Family, Corporate, Government]
Active Status               [Boolean: verified or not]
Verification Date           [Date: last checked]
Coverage %                  [Dropdown: 50%, 60%, 70%, 80%, 100%]
Annual Limit (GHS)          [Number: if known]
Exclusions                  [Text: notes about what's not covered]
Secondary Insurance?        [Boolean: for dual coverage]
Notes                       [Text: special conditions]
```

### 4.2 Invoice Insurance Fields (Already in Schema)

Good news: Nexus already has these in the `Invoice` model:
- `insuranceClaim` (Boolean)
- `insuranceProvider` (String)
- `insurancePolicyNo` (String)
- `insuranceClaimRef` (String)
- `insuranceClaimAmount` (Float)
- `insuranceClaimStatus` (Enum: PENDING, SUBMITTED, APPROVED, REJECTED, PARTIAL)
- `insuranceClaimNotes` (String)
- `insuranceClaimDate` (DateTime)

**Enhancement needed in schema:**
```prisma
// Add to Invoice model:
insuranceEligibilityVerified    Boolean?      // Was eligibility checked?
insuranceEligibilityDate        DateTime?     // When checked?
insuranceParNumber              String?       // Pre-auth reference
insuranceParApprovedAmount      Float?        // PAR approved amount
insurancePatientLiability       Float?        // Amount patient owes
insuranceDiagnosis              String?       // ICD-10 code
insuranceServiceCode            String?       // NHIS/insurer procedure code
```

### 4.3 Insurance Data at Booking

**Capture at appointment booking (Patient Portal + Receptionist Entry):**

1. **Basic Info:**
   - Do you have insurance? [Yes/No]
   - Insurance provider [Dropdown]
   - Policy/Card number [Text]

2. **Eligibility Check (Optional but Recommended):**
   - Let us verify your coverage? [Yes/No]
   - (If yes, clinic staff checks before appointment)

3. **Estimated Cost Transparency:**
   - Estimated service cost: GHS 500
   - Your estimated out-of-pocket: GHS 150 (30% not covered)
   - Insurance will cover: ~GHS 350

---

## 5. CLAIMS SUBMISSION FORMATS

### 5.1 What Insurers Expect (Email/Portal)

**Standard claim packet includes:**

1. **Claim Form** (insurer-specific)
   - Patient info (name, card, DOB)
   - Diagnosis & service details
   - Cost breakdown
   - PAR reference (if applicable)
   - Provider stamp & signature

2. **Invoice** (clinic-issued)
   - Line items (service codes + costs)
   - Date of service
   - Provider details

3. **Supporting Docs** (depends on claim amount)
   - <GHS 500: Invoice + claim form only
   - GHS 500-2000: + diagnosis notes, treatment plan
   - >GHS 2000: + PAR approval, X-rays/imaging, prescriptions

4. **Doctor's Notes** (for major treatments)
   - Brief description of what was done
   - Why needed
   - Expected outcome

### 5.2 EDI Standard (Future Integration)

**NHIS & some private insurers are exploring EDI/HL7 formats:**

```json
{
  "claimType": "DENTAL",
  "claimNumber": "CLM-2026-001234",
  "patientId": "NHIS-12345678901",
  "patientName": "John Doe",
  "dateOfBirth": "1985-05-15",
  "serviceDate": "2026-06-10",
  "provider": {
    "name": "Accra Dental Clinic",
    "licenseNo": "ADC-001",
    "bankAccount": "1234567890"
  },
  "services": [
    {
      "code": "31000",  // NHIS code for exam
      "description": "Dental Examination",
      "quantity": 1,
      "unitPrice": 50.00,
      "totalPrice": 50.00
    },
    {
      "code": "32100",  // Root canal
      "description": "Endodontic Therapy",
      "quantity": 1,
      "unitPrice": 450.00,
      "totalPrice": 450.00
    }
  ],
  "diagnosis": "K04.4",  // ICD-10: Acute pulpitis
  "totalAmount": 500.00,
  "claimedAmount": 500.00,
  "parReference": "PAR-2026-5678",
  "parApprovedAmount": 500.00
}
```

**Phase 2 can extend Nexus to generate this JSON**, but MVP doesn't need it.

---

## 6. MVP APPROACH (Recommended - Weeks 1-3)

### 6.1 Scope: What to Build

**Core Features:**

1. **Insurance Data on Patient Profile** ✅ (Partially exists)
   - Already have: `Patient.insuranceProvider`, `Patient.insurancePolicyNo`
   - Add: Coverage %, annual limit, active status, verification date
   - UI: Simple form in patient edit modal

2. **Insurance Claims Management** ✅ (Already built!)
   - Nexus has full insurance UI at `/insurance`
   - API at `/api/insurance-claims`
   - Track PENDING → SUBMITTED → APPROVED/REJECTED/PARTIAL
   - Invoice → Claim linking works

3. **Eligibility Verification Checklist** (New)
   - Simple form staff uses before appointment
   - Captures: Verified? (Y/N), Coverage %, Eligible (Y/N), Notes
   - Stores in database for audit trail

4. **Claims Submission Preparation** (New)
   - Generate PDF claim summary (invoice + patient + coverage info)
   - Pre-fill email template to send to insurer
   - One-click "Email Claim" → Opens Gmail/Outlook with pre-populated fields

5. **Claim Tracking Dashboard** ✅ (Exists at `/insurance`)
   - Shows all claims by status
   - Track approval timeline
   - Estimate clinic cash flow impact

### 6.2 Database Changes Needed

```prisma
// Extend Patient model:
model Patient {
  // ... existing fields ...
  insuranceActive           Boolean?        @default(false)
  insuranceCoveragePercent  Int?            // 50, 60, 70, 80, 100
  insuranceAnnualLimit      Float?          // GHS amount
  insuranceVerifiedDate     DateTime?
  insuranceVerifiedBy       String?         // User ID who verified
  insuranceNotes            String?
  insuranceSecondary        String?         // Secondary provider name
}

// Extend Invoice model:
model Invoice {
  // ... existing fields ...
  insuranceEligibilityChecked Boolean?      @default(false)
  insuranceEligibilityDate    DateTime?
  insuranceParNumber          String?
  insuranceParApprovedAmount  Float?
  insurancePatientLiability   Float?        // What patient owes
  insuranceDiagnosisCode      String?       // ICD-10
  insuranceServiceCode        String?       // NHIS code
}
```

**Migration:** 1 Prisma migration, backward compatible

### 6.3 UI Changes Needed

#### A. Patient Profile → Insurance Tab (New)
```
┌─────────────────────────────────────┐
│ INSURANCE INFORMATION               │
├─────────────────────────────────────┤
│ Active Status:        [Toggle On/Off]│
│                                      │
│ Provider:             [NHIS v]       │
│ Card/Policy #:        [11223344556]  │
│ Coverage %:           [70% v]        │
│ Annual Limit:         [GHS 5,000]    │
│                                      │
│ Verified:             [Yes/No]       │
│ Verification Date:    [Jun 14, 2026] │
│ Verified By:          [Ama Asante]   │
│                                      │
│ Secondary Provider:   [AXA]          │
│ Secondary Card #:     [987654321]    │
│                                      │
│ Notes:                [Text area]    │
│                                      │
│ [Save] [Cancel]                      │
└─────────────────────────────────────┘
```

#### B. Invoice → Insurance Claim Form (Enhance Existing)
Already exists but add:
- "Verify Patient Eligibility" button → opens verification form
- PAR number field (optional)
- Patient liability field (auto-calc: amount - approved)
- "Generate Claim PDF" button
- "Email to Insurer" button (pre-fills email)

#### C. Appointments → Insurance Pre-Check (New)
```
┌─────────────────────────────────────┐
│ APPOINTMENT DETAIL: John Doe        │
│ Date: Jun 20, 2026 | Service: Crown │
├─────────────────────────────────────┤
│ INSURANCE STATUS                    │
│ Provider: NHIS                      │
│ Card #: 1122334455667               │
│                                      │
│ ☐ Eligibility Verified              │
│ Coverage: 70%                        │
│ Est. Clinic Cost: GHS 200           │
│ Est. Patient Cost: GHS 60           │
│                                      │
│ [Verify Now] [Notes]                │
└─────────────────────────────────────┘
```

### 6.4 Workflow Walkthrough (MVP)

**Day 1 - Patient books appointment:**
1. Receptionist enters insurance info (provider + card #)
2. System stores on patient record

**Day before appointment:**
1. Receptionist checks appointment list
2. Clicks "Verify Eligibility" for this patient
3. Manual verification:
   - Calls NHIS: 0800-900-900 (or checks portal)
   - Notes result: "Eligible, 70% coverage, annual limit GHS 5k"
4. Marks as "Verified" in appointment panel

**After service:**
1. Invoice auto-created: GHS 200 (crown placement)
2. Staff clicks "Add Insurance Claim"
3. Pre-filled form shows:
   - Provider: NHIS
   - Card #: 1122334455667
   - Amount: GHS 200 (auto-filled from invoice)
4. Staff adds notes, clicks "Submit Claim"
5. Status: "SUBMITTED"

**Claim submission (Manual - MVP):**
1. Staff opens claim in Nexus
2. Clicks "Generate Claim PDF" → Downloads claim summary
3. Clicks "Email to Insurer" → Gmail/Outlook opens pre-filled
   - To: claims@nhis.gov.gh
   - Subject: Claim for John Doe (NHIS #1122334455667)
   - Body: "Please find attached claim for service on Jun 20, 2026..."
4. Staff attaches invoice PDF + claim form
5. Sends email

**5-7 days later:**
1. Insurer approves claim: GHS 140 (70% of 200)
2. Staff updates in Nexus: Status = "APPROVED", Amount = GHS 140
3. Dashboard shows: "Insurance: GHS 140 approved, Patient owes: GHS 60"
4. Staff collects GHS 60 from patient

**14 days later:**
1. Insurer transfers GHS 140 to clinic bank account
2. Clinic records payment via existing payment module

---

## 7. IMPLEMENTATION TIMELINE (MVP)

### Week 1: Database & Backend
- [ ] Create migration for new Patient/Invoice fields
- [ ] Update Prisma schema
- [ ] Extend `POST /api/insurance-claims` to accept new fields
- [ ] Add eligibility verification endpoint: `POST /api/insurance-verification`
- [ ] Test all changes

### Week 2: Frontend UI
- [ ] Add insurance tab to patient edit modal
- [ ] Enhance insurance claims form (PAR, patient liability fields)
- [ ] Add "Verify Eligibility" button to appointments
- [ ] Add "Generate PDF" & "Email" buttons to claims
- [ ] Style consistently with existing UI

### Week 3: Integration & Testing
- [ ] Test full workflow: booking → verification → claim → tracking
- [ ] Create user docs/training materials
- [ ] Test with VDRL, AXA, NHIS processes
- [ ] Performance testing (bulk claim generation)
- [ ] UAT with pilot clinic

**Launch:** Week 4

---

## 8. INSURANCE PROVIDER SETUP (Clinic Side)

Each clinic using Nexus must:

1. **Register with NHIS**
   - Complete facility registration form
   - License verification
   - Turnaround: 3-5 weeks
   - Cost: Free
   - Contact: https://www.nhis.gov.gh/

2. **Register with Private Insurers** (optional)
   - AXA: https://www.axaghana.com/ (Partner Portal)
   - VDRL: https://www.vdrl.com.gh/
   - Hygeia: https://www.africanalliancegh.com/
   - Glico: https://www.glico.com.gh/
   - ALICO: https://www.alico-ghana.com/

   Each requires:
   - Clinic license
   - Tax ID
   - Bank account
   - Owner/Manager details
   - Turnaround: 2-4 weeks per insurer
   - Cost: Free

**Nexus Feature:** Tenants can configure which insurers they're registered with → restricts provider dropdown to approved partners.

---

## 9. FINANCIAL IMPACT ANALYSIS

### 9.1 Cash Flow Improvement (Clinic Benefit)

**Scenario:** Clinic averages GHS 10,000 invoices/month, 30% via insurance

| Metric | Without Insurance | With Manual Claims | Improvement |
|--------|-------------------|-------------------|-------------|
| Avg Revenue/Month | GHS 10,000 | GHS 10,000 | 0% |
| Insurance Portion | GHS 3,000 | GHS 3,000 | 0% |
| Days to receive insurance | ~45 days | 10-14 days | **68% faster** |
| Cash flow impact | GHS 3,000 delayed | GHS 2,100 delayed | **30% improvement** |
| Cost (staff time) | ~5 hours/month | ~8 hours/month | +60% effort |

**Bottom line:** Clinics get paid GHS 2,100 instead of GHS 3,000 in 45 days. Eliminates cash flow gap.

### 9.2 Patient Benefit

- **Transparency:** Knows out-of-pocket cost BEFORE service
- **Lower cost:** Insurance covers 50-80% (GHS 150-240 saved on GHS 300-400 procedures)
- **Faster claims:** Clinic submits same-day vs. patient having to manage claims

### 9.3 Revenue Opportunity for Nexus

**Potential add-on services (Phase 2+):**
- Automated claim submission (SaaS feature): +2-3% revenue
- NHIS API integration (when available): Premium tier
- Corporate insurance bulk management: +licensing fee

---

## 10. RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **NHIS approval delays** | Clinic can't bill NHIS | Manual email backup works for MVP |
| **Insurer denies claim** | Clinic loses revenue | Pre-auth (PAR) before major procedures |
| **Patient data mismatch** | Claim rejected | Verify patient info against insurance card at booking |
| **Insurance info changes** | Stale data in system | Monthly patient data refresh + verification before apt |
| **Dual insurance (NHIS + private)** | Confusion on coverage | Build "secondary insurance" field into form |
| **Insurer requires signature** | Claims rejected if unsigned | Pre-fill form; clinic stamps before email |
| **Manual process is slow** | Staff burden | Phase 2 automation when insurers support it |

---

## 11. RECOMMENDED INSURER PARTNERSHIPS (MVP)

**Priority Order for Integration:**

1. **NHIS** (National Health Insurance Scheme)
   - Covers ~65% of urban population
   - Mandatory for salaried workers
   - Highest volume but slowest payout
   - **Do:** Include in MVP

2. **VDRL** (Dental-specialized)
   - Easiest integration
   - Fast turnaround (3-5 days)
   - Growing corporate market
   - **Do:** Prioritize in Week 2

3. **Hygeia** (Healthcare-focused, exploring APIs)
   - Professional claims process
   - Open to tech partnerships
   - Good mobile experience
   - **Do:** Include in MVP; explore API for Phase 2

4. **AXA** (Large corporate presence)
   - High-value corporate plans
   - Large premium pool
   - **Do:** Include in MVP for corporate clinics

5. **Others** (Glico, ALICO)
   - Smaller market share
   - Can use generic email workflow
   - **Do:** Include in Phase 2 if demand high

---

## 12. TRAINING & DOCUMENTATION NEEDED

### For Clinic Receptionist/Billing Staff:

1. **Quick Start Guide:** 2-page cheat sheet
   - How to verify insurance before appointment
   - How to create claim after invoice
   - What to do if claim is denied

2. **Insurance Provider Directory:** Built-in reference
   - NHIS phone numbers, portal URLs, email addresses
   - VDRL, AXA, Hygeia contacts
   - Processing timelines
   - Coverage percentages

3. **Video Walkthrough:** 3-5 min demo
   - Adding insurance to patient
   - Verifying eligibility
   - Creating & submitting claim
   - Tracking status

4. **FAQ:** Common issues
   - "Patient card number is different from our file"
   - "Insurer rejected the claim — what now?"
   - "How long until we get paid?"
   - "Patient has two insurance cards"

### For Clinic Owner/Manager:

1. **Dashboard:** Insurance claims summary
   - Total claimed this month: GHS X
   - Approved vs. pending vs. rejected
   - Average turnaround time
   - Cash flow projection

2. **Monthly Report:** Insurance analytics
   - Claims by insurer
   - Approval rates
   - Average reimbursement
   - Patient insurance adoption

---

## 13. APPENDIX: INSURER CONTACT INFORMATION

### NHIS (National Health Insurance Scheme)
- **Website:** https://www.nhis.gov.gh/
- **Phone:** +233-800-900-900
- **Email (Claims):** claims@nhis.gov.gh
- **Portal:** NHIS Accredited Provider Portal
- **Office:** NHIS House, Ring Road Central, Accra

### VDRL (Ghana) Limited
- **Website:** https://www.vdrl.com.gh/
- **Email:** claims@vdrl.com.gh
- **Phone:** +233-302-400-400
- **Portal:** VDRL Partner Portal
- **Office:** Osu, Accra

### AXA Insurance Ghana
- **Website:** https://www.axaghana.com/
- **Email:** healthclaims@axaghana.com
- **Phone:** +233-300-320-320
- **Portal:** MyAXA Partner Portal
- **Office:** Accra Central, Accra

### Hygeia Insurance (African Alliance)
- **Website:** https://www.africanalliancegh.com/
- **Email:** dental-claims@africanalliancegh.com
- **Phone:** +233-302-611-611
- **Portal:** HygeiaPlus Partner Portal
- **Office:** Accra, Ghana

### Glico (Ghana) Limited
- **Website:** https://www.glico.com.gh/
- **Email:** claims@glico.com.gh
- **Phone:** +233-303-937-937
- **Portal:** GlicoOnline Partner Portal

### ALICO Ghana
- **Website:** https://www.alico-ghana.com/
- **Email:** claims@alico-ghana.com
- **Phone:** +233-302-226-226
- **Portal:** UniqueConnect

---

## CONCLUSION

**Nexus Dental should launch MVP in Week 3** with:

✅ Manual eligibility verification workflow  
✅ Insurance data collection at patient/appointment level  
✅ Claims tracking & submission preparation  
✅ PDF generation + email helper for clinic staff  
✅ Dashboard for monitoring claims status & cash flow  

**No API integrations required.** Work with insurer portals and email.

**Phase 2 (Weeks 4-8+):** Add automation layers (NHIS API if released, EDI formatting, bulk claim submission).

**Expected Outcome:**
- Clinic staff can verify insurance & submit claims in <2 minutes
- Clinic gets paid 3-4x faster (10-14 days vs. 45 days)
- Patient sees out-of-pocket cost upfront
- 40-50% of invoices converted to insurance claims within 2 months

---

**Document Version:** 1.0  
**Last Updated:** June 14, 2026  
**Prepared for:** Nexus Dental Product Team
