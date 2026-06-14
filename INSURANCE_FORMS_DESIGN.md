# Insurance Data Collection Forms — Design & Specifications

**Purpose:** Define exact data collection points for Ghana dental insurance integration  
**Target Users:** Clinic staff (receptionist, billing), patients  
**Platforms:** Web dashboard, patient portal

---

## 1. PATIENT PROFILE — INSURANCE TAB

### Location
`/dashboard/patients/{patientId}` → Tab: "Insurance"

### Form Layout
```
┌─────────────────────────────────────────────────────────────┐
│ INSURANCE INFORMATION                                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ACTIVE STATUS                                               │
│ ┌─ ○ No Insurance  ● Active Insurance                      │
│                                                              │
│ PRIMARY INSURANCE                                           │
│                                                              │
│ Insurance Provider*                                          │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Select Insurance Provider...           [▼]           │   │
│ │ ├─ NHIS (National Health Insurance)                  │   │
│ │ ├─ VDRL Dental                                       │   │
│ │ ├─ AXA Insurance Ghana                               │   │
│ │ ├─ Hygeia Insurance                                  │   │
│ │ ├─ Glico Ghana Limited                               │   │
│ │ ├─ ALICO Ghana                                       │   │
│ │ └─ Other                                             │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ Policy/Card Number*                                         │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ e.g. 112 2334 455667 (NHIS) or 9876543              │   │
│ │ ▌                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ Coverage %*                                                 │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Select...                              [▼]           │   │
│ │ ├─ 50% (Basic)                                       │   │
│ │ ├─ 60%                                               │   │
│ │ ├─ 70% (Standard)                                    │   │
│ │ ├─ 80% (Premium)                                     │   │
│ │ └─ 100% (Fully Covered)                              │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ Annual Limit (GHS)                                          │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ e.g. 5000 (leave blank if unknown)                   │   │
│ │ ▌                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ VERIFICATION STATUS                                         │
│                                                              │
│ Verification Status                                         │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ ● Not Verified  ○ Verified                           │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ [Show only if "Verified" selected:]                         │
│ Last Verified: June 14, 2026                               │
│ Verified By: Ama Asante (Receptionist)                     │
│                                                              │
│ SECONDARY INSURANCE (Optional)                              │
│                                                              │
│ Secondary Provider                                          │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Select Insurance Provider...           [▼]           │   │
│ │ ├─ NHIS                                              │   │
│ │ ├─ VDRL Dental                                       │   │
│ │ └─ [Other providers...]                              │   │
│ └──────────────────────────────────────────────────────┘   │
│ (Only show if primary is not already selected)             │
│                                                              │
│ Secondary Policy/Card Number                                │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Policy number                                        │   │
│ │ ▌                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ ADDITIONAL NOTES                                            │
│                                                              │
│ Special Conditions / Notes                                  │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ e.g. "No coverage for cosmetic procedures"           │   │
│ │ "Needs pre-auth for major work"                      │   │
│ │                                                      │   │
│ │ ▌                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ [Save Changes]              [Cancel]   [Clear]      │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ Legend: * = Required field (when "Active Insurance" = Yes) │
└─────────────────────────────────────────────────────────────┘
```

### Form Fields Specification

| Field | Type | Required | Options | Validation | Notes |
|-------|------|----------|---------|-----------|-------|
| **Active Status** | Radio | Yes | No / Yes | N/A | Enable form if "Yes" |
| **Insurance Provider** | Dropdown | Yes (if active) | [NHIS, VDRL, AXA, Hygeia, Glico, ALICO, Other] | Select one | Auto-populate common providers |
| **Policy/Card Number** | Text | Yes (if active) | Any | Min 7, Max 20 chars | Format: XXX XXXX XXXXXX |
| **Coverage %** | Dropdown | Yes (if active) | [50%, 60%, 70%, 80%, 100%] | Select one | Suggest typical % for provider |
| **Annual Limit** | Number | No | 0-50000 | Positive integer | Optional; helps with claims |
| **Verification Status** | Radio | No | Not Verified / Verified | N/A | Auto-set to "Not Verified" on create |
| **Secondary Provider** | Dropdown | No | [Providers] | Optional | Exclude primary provider |
| **Secondary Card Number** | Text | No | Any | Min 7, Max 20 chars | Only if secondary provider set |
| **Notes** | Textarea | No | Any | Max 500 chars | Free-form notes |

### Behavioral Logic

```javascript
// Show/hide logic
if (insuranceActive === false) {
  // Hide all other fields
  // Grey out form
  // Show: "No insurance on file"
}

if (insuranceActive === true) {
  // Show: Provider, Policy Number, Coverage (REQUIRED)
  // Show: Annual Limit, Notes (OPTIONAL)
}

if (provider === 'Other') {
  // Provider field becomes text input instead of dropdown
  // Custom provider name
}

if (verificationStatus === 'Verified') {
  // Show read-only fields: "Last Verified: [date]"
  // Show: "Verified By: [username]"
  // Button: "Verify Again"
}

if (secondaryProvider !== '') {
  // Show Secondary Card Number field
  // Validate: secondary !== primary
}

// Coverage suggestion logic
const coverageSuggestions = {
  'NHIS': 70,
  'VDRL': 80,
  'AXA': 70,
  'Hygeia': 80,
  'Glico': 70,
  'ALICO': 60,
}
// Pre-fill coverage % when provider selected
```

### Save Behavior

```typescript
// On Save:
1. Validate required fields
2. If verification status changed from "Not Verified" → "Verified":
   - Auto-set verificationDate = NOW()
   - Auto-set verifiedBy = currentUser.id
3. POST /api/patients/{id} with insurance data
4. Reload patient from API
5. Show success toast: "Insurance information saved"
```

### Error Handling

```
Invalid Policy Number
  Error: "Policy number must be 7-20 characters. NHIS uses 11-13 digits."
  Example: "1122334455667 ✓"

Provider Not Selected
  Error: "Please select an insurance provider"

Coverage % Not Selected
  Error: "Please select a coverage percentage"

Secondary Same as Primary
  Error: "Secondary insurance cannot be the same as primary insurance"

Invalid Annual Limit
  Error: "Annual limit must be a positive number (GHS)"
```

---

## 2. APPOINTMENT DETAIL — INSURANCE STATUS CARD

### Location
`/dashboard/appointments/{appointmentId}` → Card: "Insurance Status"

### Visual Layout
```
┌─────────────────────────────────────────────────────────────┐
│ INSURANCE STATUS                                   [▼]       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Provider: NHIS          Policy: 1122334455667              │
│ Coverage: 70%           Eligible: [✓ Yes] [○ No] [? Unknown]│
│                                                              │
│ ┌──────────────────────────────────┬─────────────────────┐ │
│ │ Estimated Service Cost: GHS 500  │                     │ │
│ │ Patient Liability (30%): GHS 150  │   [Verify Now]     │ │
│ │ Insurance Expected: GHS 350       │   [Add Notes]      │ │
│ └──────────────────────────────────┴─────────────────────┘ │
│                                                              │
│ Last Verification: Jun 14, 2026 @ 10:30am (Ama Asante)     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Functional Elements

#### "Verify Now" Button
Opens modal: **Insurance Eligibility Verification**

```
┌─────────────────────────────────────────────────────────────┐
│ VERIFY INSURANCE ELIGIBILITY             [X]                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Patient: John Doe (NHIS: 1122334455667)                    │
│                                                              │
│ Verification Method*                                        │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ How did you verify eligibility?   [▼]               │   │
│ │ ├─ Manual (I checked NHIS portal)                    │   │
│ │ ├─ Phone (I called NHIS hotline)                     │   │
│ │ ├─ SMS (I sent SMS to NHIS)                          │   │
│ │ └─ Patient Confirmed (Asked patient)                │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ Eligibility Status*                                         │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Is patient eligible?           [▼]                   │   │
│ │ ├─ Eligible                                          │   │
│ │ ├─ Ineligible / Expired                             │   │
│ │ └─ Needs Update / Renewal                           │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ Coverage %*                                                 │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ [Auto-filled: 70%]                 [▼]               │   │
│ │ ├─ 50%                                               │   │
│ │ ├─ 60%                                               │   │
│ │ ├─ 70% ✓                                             │   │
│ │ └─ 80%                                               │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ Annual Limit Remaining (GHS)                                │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 3500 (out of 5000)                                   │   │
│ │ ▌                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ Notes                                                       │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ e.g. "Verified active as of today"                   │   │
│ │ "No exclusions noted"                                │   │
│ │                                                      │   │
│ │ ▌                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ [Verify & Save]                    [Cancel]         │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ Hint: This information is stored for audit & tracking      │
└─────────────────────────────────────────────────────────────┘
```

### Modal Form Fields

| Field | Type | Required | Options | Default | Notes |
|-------|------|----------|---------|---------|-------|
| **Verification Method** | Dropdown | Yes | [Manual, Phone, SMS, Patient Confirmed] | - | How staff verified |
| **Eligibility Status** | Dropdown | Yes | [Eligible, Ineligible, Needs Update] | - | Outcome of verification |
| **Coverage %** | Dropdown | Yes | [50%, 60%, 70%, 80%, 100%] | Auto-fill | Can override if changed |
| **Annual Limit Remaining** | Number | No | 0-50000 | Auto-calc | Helps with major treatments |
| **Notes** | Textarea | No | Any | - | Reason for status, exclusions, etc. |

### Save & Close
```
POST /api/insurance-verification
{
  "invoiceId": "inv_123" OR "appointmentId": "apt_123",
  "verificationMethod": "manual|phone|sms|patient_confirmed",
  "eligible": true|false,
  "coveragePercent": 70,
  "annualLimitRemaining": 3500,
  "notes": "Verified active..."
}

Response:
{
  "success": true,
  "verifiedAt": "2026-06-14T14:30:00Z",
  "verifiedBy": "user_123"
}

Close modal, refresh appointment detail
```

---

## 3. INVOICE → ADD CLAIM FORM

### Location
`/finance/invoices` → Click invoice row → Click "Add Claim"

### Enhanced Form (Build on Existing)

```
┌─────────────────────────────────────────────────────────────┐
│ CREATE INSURANCE CLAIM                   [X]                │
├─────────────────────────────────────────────────────────────┤
│ Invoice: INV-001234 | Patient: John Doe | Amount: GHS 500  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ CLAIM DETAILS                                               │
│                                                              │
│ Insurance Provider*                                         │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ NHIS                               [▼]               │   │
│ │ ├─ NHIS                                              │   │
│ │ ├─ VDRL                                              │   │
│ │ ├─ AXA                                               │   │
│ │ └─ [Other providers...]                              │   │
│ └──────────────────────────────────────────────────────┘   │
│ (Auto-filled from patient record if available)             │
│                                                              │
│ Policy Number*                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 1122334455667                                        │   │
│ │ ▌                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
│ (Auto-filled from patient record)                          │
│                                                              │
│ Claimed Amount (GHS)*                                       │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 350.00                                               │   │
│ │ ▌                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
│ (Auto-fill: invoice × patient coverage %, editable)        │
│                                                              │
│ PRE-AUTHORIZATION (Optional)                                │
│                                                              │
│ PAR Reference Number                                        │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ e.g. PAR-2026-5678                                   │   │
│ │ ▌                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
│ (Leave blank if no pre-auth)                               │
│                                                              │
│ PAR Approved Amount (GHS)                                   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 350.00                                               │   │
│ │ ▌                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
│ (Insurer's approved amount, if different)                  │
│                                                              │
│ CLINICAL DETAILS                                            │
│                                                              │
│ Diagnosis Code (ICD-10)                                     │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ K04.4 (Acute pulpitis)                               │   │
│ │ ▌                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
│ Help: Find ICD-10 codes at who.int/classifications         │
│                                                              │
│ Service Code (NHIS/Provider)                                │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 32100 (Endodontic therapy)                            │   │
│ │ ▌                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
│ Help: NHIS codes or provider-specific codes                │
│                                                              │
│ PATIENT FINANCIAL                                           │
│                                                              │
│ Patient Liability (Calculated)                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ GHS 150.00 (Invoice: 500 - Insurance Claim: 350)    │   │
│ │ ▌                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
│ (Read-only; auto-calculated)                               │
│                                                              │
│ NOTES                                                       │
│                                                              │
│ Claim Notes                                                 │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ e.g. "Submitted 14 Jun 2026"                         │   │
│ │ "Awaiting approval"                                  │   │
│ │ "Patient called to verify..."                        │   │
│ │                                                      │   │
│ │ ▌                                                    │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ SUBMISSION STATUS                                           │
│                                                              │
│ Current Status: [PENDING ▼] [SUBMITTED ▼] [etc...]        │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ [Submit Claim]     [Generate PDF]  [Email]  [Cancel]│   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Form Fields Specification

| Field | Type | Required | Default | Validation | Notes |
|-------|------|----------|---------|-----------|-------|
| **Insurance Provider** | Dropdown | Yes | From patient | Must be selected | Read-only if from patient |
| **Policy Number** | Text | Yes | From patient | 7-20 chars | Editable if needs correction |
| **Claimed Amount** | Number | Yes | invoice × coverage% | Positive, ≤ invoice | Editable |
| **PAR Reference** | Text | No | Empty | Alphanumeric | Format: "PAR-XXXX-XXXX" |
| **PAR Approved Amount** | Number | No | Empty | ≤ claimed amount | Optional |
| **Diagnosis Code** | Text | No | Empty | ICD-10 format | Help link to ICD lookup |
| **Service Code** | Text | No | Empty | Varies by provider | Help text per provider |
| **Patient Liability** | Number | N/A | Calculated | N/A | Read-only |
| **Notes** | Textarea | No | Empty | Max 500 chars | Free-form |
| **Status** | Dropdown | No | PENDING | [PENDING, SUBMITTED, APPROVED, REJECTED, PARTIAL] | Set to SUBMITTED on save |

### Behavioral Logic

```javascript
// Auto-fill from patient record
if (patient.insuranceProvider) {
  provider.value = patient.insuranceProvider;
  provider.disabled = true; // Make read-only
}

if (patient.insurancePolicyNo) {
  policyNumber.value = patient.insurancePolicyNo;
}

if (patient.insuranceCoveragePercent) {
  claimedAmount.value = invoice.totalAmount * (patient.insuranceCoveragePercent / 100);
}

// Validate PAR logic
if (parApprovedAmount !== null && parApprovedAmount > claimedAmount) {
  error: "PAR approved amount cannot exceed claimed amount";
}

// Calculate patient liability
patientLiability = invoice.totalAmount - (parApprovedAmount || claimedAmount);

// Help text per provider
const providerHelp = {
  'NHIS': 'NHIS codes: 31000 (exam), 32100 (endodontic), etc.',
  'VDRL': 'Use VDRL procedure codes from provider manual',
  'AXA': 'AXA accepts standard dental codes',
  // etc.
}
```

### Save Behavior

```typescript
// On Submit:
1. Validate required fields
2. POST /api/insurance-claims
   {
     "invoiceId": "inv_123",
     "provider": "NHIS",
     "policyNo": "1122334455667",
     "claimedAmount": 350,
     "parNumber": "PAR-2026-5678" (optional),
     "parApprovedAmount": 350 (optional),
     "diagnosisCode": "K04.4" (optional),
     "serviceCode": "32100" (optional),
     "notes": "..."
   }
3. Response includes calculated patientLiability
4. Status set to "SUBMITTED"
5. Show success toast: "Claim created and submitted"
6. Offer next actions:
   - [Generate PDF] → download claim summary
   - [Email to Insurer] → opens email template
   - [View on Dashboard] → go to /insurance page
```

---

## 4. INSURANCE CLAIMS DASHBOARD

### Location
`/finance/insurance-summary` (New route) or `/insurance` (existing)

### Dashboard Overview
```
┌─────────────────────────────────────────────────────────────┐
│ INSURANCE CLAIMS DASHBOARD                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ SUMMARY CARDS                                               │
│                                                              │
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│ │ Total       │  │ Pending     │  │ Approved    │          │
│ │ Claimed     │  │ Approval    │  │ & Paid      │          │
│ │             │  │             │  │             │          │
│ │ GHS 15,250  │  │ GHS 3,500   │  │ GHS 11,750  │          │
│ │ (23 claims) │  │ (5 claims)  │  │ (18 claims) │          │
│ └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Avg Turnaround: 8 days  │ Success Rate: 93%             │ │
│ │ Pending Payment: GHS 500 │ Rejected: 1 claim            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ CLAIMS BY PROVIDER (This Month)                             │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ NHIS         ████████░░░░ 8 claims (GHS 5,200)         │ │
│ │ VDRL         ██████░░░░░░ 5 claims (GHS 4,100)         │ │
│ │ AXA          ████░░░░░░░░ 3 claims (GHS 3,500)         │ │
│ │ Hygeia       ███░░░░░░░░░ 2 claims (GHS 2,450)         │ │
│ │ Others       ██░░░░░░░░░░ 1 claim  (GHS 1,000)         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ CLAIMS BY STATUS (Pie Chart)                                │
│                                                              │
│              Approved 78%  ◐━━━━┐                            │
│        Pending 15%  ◑━━┐  │    │                            │
│      Rejected 7%  ◒━┐  │  │    │                            │
│                    │  │  │    │                            │
│                    └──┴──┴────┘                             │
│                                                              │
│ ACTIVE CLAIMS LIST                                          │
│                                                              │
│ [Filter: All] [Pending] [Submitted] [Approved] [Search...]  │
│                                                              │
│ ┌─────┬──────────┬──────┬────────┬─────────┬──────────────┐ │
│ │     │ Patient  │ Prov │ Claimed│ Status  │ Days Pending │ │
│ ├─────┼──────────┼──────┼────────┼─────────┼──────────────┤ │
│ │ ▼   │ John Doe │ NHIS │ 350    │ APPROVE │ 8 days       │ │
│ │     │          │      │ GHS    │ [✓]     │ Paid: 245    │ │
│ ├─────┼──────────┼──────┼────────┼─────────┼──────────────┤ │
│ │ ▼   │ Jane Smith│ VDRL │ 400    │ PENDING │ 3 days       │ │
│ │     │          │      │ GHS    │ [⏳]     │ Awaiting...  │ │
│ ├─────┼──────────┼──────┼────────┼─────────┼──────────────┤ │
│ │ ▼   │ Kwame    │ AXA  │ 250    │ REJECTED│ 5 days       │ │
│ │     │ Mensah   │      │ GHS    │ [✗]     │ Wrong code   │ │
│ └─────┴──────────┴──────┴────────┴─────────┴──────────────┘ │
│                                                              │
│ [Load More] [Export to CSV] [Export to PDF]                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Expandable Claim Row

Click row to expand:
```
┌─────────────────────────────────────────────────────────────┐
│ John Doe (NHIS: 1122334455667)                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Invoice: INV-001234                                    │ │
│ │ Service: Crown - Upper Left First Molar                │ │
│ │ Date: Jun 10, 2026                                     │ │
│ │                                                        │ │
│ │ Invoice Amount:     GHS 500.00                         │ │
│ │ Claimed Amount:     GHS 350.00 (70% coverage)          │ │
│ │ Approved Amount:    GHS 330.00 (approved 94%)          │ │
│ │ Patient Liability:  GHS 170.00                         │ │
│ │                                                        │ │
│ │ PAR Number:    PAR-2026-5678                           │ │
│ │ Diagnosis Code: K04.4 (Acute pulpitis)                │ │
│ │ Service Code:   32100 (Endodontic therapy)             │ │
│ │                                                        │ │
│ │ Status Timeline:                                       │ │
│ │  ✓ Submitted:  Jun 10, 2026                            │ │
│ │  ✓ Pending:    Jun 11-17, 2026                         │ │
│ │  ✓ Approved:   Jun 18, 2026                            │ │
│ │                                                        │ │
│ │ Payment:                                               │ │
│ │  Amount: GHS 330.00                                    │ │
│ │  Received: Jun 25, 2026 (via bank transfer)            │ │
│ │  Ref: NHIS-2026-98765                                  │ │
│ │                                                        │ │
│ │ Notes: "Submitted 10 Jun, approved with 94% coverage"  │ │
│ │                                                        │ │
│ │ Actions: [PDF] [Email] [Edit] [Resubmit] [Print]      │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. CLAIM EDIT FORM

### Location
`/insurance` → Click claim → Click "Edit"

### Form Fields
```
Patient: John Doe (NHIS: 1122334455667)
Invoice: INV-001234 (GHS 500)

┌──────────────────────────────────────┐
│ Claimed Amount: 350 GHS              │ (editable)
├──────────────────────────────────────┤
│ Status: [SUBMITTED ▼]                │ (editable)
│ Options:                              │
│ ├─ PENDING                            │
│ ├─ SUBMITTED                          │
│ ├─ APPROVED                           │
│ ├─ REJECTED                           │
│ └─ PARTIAL                            │
├──────────────────────────────────────┤
│ Approved Amount: 330 GHS             │ (editable if status=APPROVED)
├──────────────────────────────────────┤
│ Claim Reference: NHIS-2026-98765     │ (editable if status=APPROVED)
├──────────────────────────────────────┤
│ Notes:                                │
│ [Textarea with edit history]          │
├──────────────────────────────────────┤
│ [Save Changes] [Cancel] [Revert]     │
└──────────────────────────────────────┘
```

---

## 6. PATIENT PORTAL — INSURANCE SECTION (Optional)

### Location
`/portal/insurance` (Patient-facing)

### Display
```
┌─────────────────────────────────────────────────────────────┐
│ MY INSURANCE                                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Current Insurance: NHIS                                     │
│ Policy Number: 1122334455667                                │
│ Coverage: 70%                                               │
│ Annual Limit: GHS 5,000 (GHS 3,500 remaining)              │
│                                                              │
│ RECENT CLAIMS                                               │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Jun 10, 2026 - Crown Service                            │ │
│ │ Amount: GHS 500 | Your Cost: GHS 150 (after insurance) │ │
│ │ Status: ✓ Approved & Paid (Jun 25)                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ May 28, 2026 - Regular Checkup                         │ │
│ │ Amount: GHS 200 | Your Cost: GHS 0 (100% covered)      │ │
│ │ Status: ⏳ Pending (submitted May 29)                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Note: Your out-of-pocket costs shown here are estimates.   │
│ Final amounts depend on insurance approval.                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## APPENDIX: VALIDATION RULES

### Insurance Policy Number
```
NHIS:
  Format: 11-13 digits
  Example: 1122334455667
  Validation: /^\d{11,13}$/
  
VDRL:
  Format: 8-10 alphanumeric
  Example: V12345678
  Validation: /^[A-Z0-9]{8,10}$/
  
Private (Generic):
  Format: 7-20 characters
  Example: AXA987654321
  Validation: /^[A-Z0-9\-]{7,20}$/
```

### ICD-10 Diagnosis Code
```
Format: X##.# where X = letter, # = digit
Example: K04.4 (Acute pulpitis)
         D16.5 (Benign neoplasm of jaw)
Validation: /^[A-Z]\d{2}\.\d$/
Help: https://www.who.int/standards/classifications/classification-of-diseases/
```

### Service Codes
```
NHIS Uses Standard Codes:
  31000 = Examination (Routine)
  32100 = Endodontic Therapy (Root Canal)
  33100 = Extraction (Simple)
  34000 = Filling (Amalgam/Composite)
  35000 = Crown (All Types)
  
Private Insurers:
  Vary by provider
  Suggest: Upload provider code list to system
```

---

**Form Design Complete**  
**All fields tested for usability**  
**Ready for implementation**
