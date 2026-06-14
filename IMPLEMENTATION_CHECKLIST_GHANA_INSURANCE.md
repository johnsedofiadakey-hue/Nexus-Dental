# Ghana Insurance Integration — Implementation Checklist

**Project Timeline:** 3 weeks (MVP)  
**Start Date:** Week 1, June 2026  
**Launch Date:** Week 4, early July 2026

---

## WEEK 1: DATABASE & BACKEND SETUP

### Phase 1.1: Database Migration

- [ ] **Create Prisma migration file**
  ```bash
  npx prisma migrate dev --name add_insurance_fields
  ```

- [ ] **Update Patient model with:**
  - `insuranceActive: Boolean?`
  - `insuranceCoveragePercent: Int?` (50, 60, 70, 80, 100)
  - `insuranceAnnualLimit: Float?`
  - `insuranceVerifiedDate: DateTime?`
  - `insuranceVerifiedBy: String?` (FK to User)
  - `insuranceNotes: String?`
  - `insuranceSecondary: String?`
  - Add index: `@@index([tenantId, insuranceActive])`

- [ ] **Update Invoice model with:**
  - `insuranceEligibilityChecked: Boolean?`
  - `insuranceEligibilityDate: DateTime?`
  - `insuranceParNumber: String?` (Pre-authorization ref)
  - `insuranceParApprovedAmount: Float?`
  - `insurancePatientLiability: Float?` (calculated: amount - approved)
  - `insuranceDiagnosisCode: String?` (ICD-10)
  - `insuranceServiceCode: String?` (NHIS/insurer code)

- [ ] **Test migration locally**
  - Verify schema changes applied
  - Check all relationships intact
  - Verify indexes created
  - Document rollback procedure

- [ ] **Backup production before deployment**

---

### Phase 1.2: API Endpoints

#### A. Insurance Verification Endpoint

- [ ] **Create `/api/insurance-verification` (POST)**
  ```typescript
  // POST /api/insurance-verification
  {
    "invoiceId": "inv_123",
    "patientId": "pat_123",
    "provider": "NHIS",
    "policyNumber": "1122334455667",
    "verificationMethod": "manual|phone|sms|portal"
  }
  
  // Response:
  {
    "verified": true,
    "eligible": true,
    "coveragePercent": 70,
    "annualLimit": 5000,
    "limitRemaining": 3500,
    "notes": "Active, verified on 2026-06-14 via NHIS portal",
    "verifiedAt": "2026-06-14T10:30:00Z",
    "verifiedBy": "user_123"
  }
  ```

- [ ] **Create `/api/insurance-verification` (GET)**
  - Get verification history for invoice
  - Return timestamp + verification details

- [ ] **Implement permission check**
  - Only billing staff / clinic admin can verify
  - Log all verifications in audit trail

- [ ] **Add error handling**
  - Invalid policy number format
  - Invalid provider
  - Network timeout (manual verification)

#### B. Enhance Existing Insurance Claims API

- [ ] **Update `POST /api/invoices/{id}/claim`**
  - Add fields:
    - `parNumber`
    - `parApprovedAmount`
    - `diagnosisCode`
    - `serviceCode`
    - `patientLiability`

- [ ] **Add calculation logic**
  - If `parApprovedAmount` set → `patientLiability` = invoice.amount - parApprovedAmount
  - Validate PAR amount <= invoice amount
  - Auto-fill coverage % from patient record

- [ ] **Enhance claim retrieval**
  - Include eligibility verification status
  - Include PAR details in response
  - Add filters: by provider, by verification status

---

### Phase 1.3: Service Layer

- [ ] **Create `src/lib/insurance/verification.ts`**
  - Function: `verifyInsuranceEligibility()`
  - Logs verification attempt (audit trail)
  - Returns eligibility status
  - Handle all provider types

- [ ] **Create `src/lib/insurance/providers.ts`**
  - List of providers (NHIS, VDRL, AXA, Hygeia, Glico, ALICO)
  - Provider metadata (contact info, typical coverage %)
  - Submission requirements per provider

- [ ] **Create `src/lib/insurance/claim-generator.ts`**
  - Function: `generateClaimPDF(invoiceId, claimId)`
  - Function: `generateClaimEmailBody(invoiceId, claimId)`
  - Returns data for email composition

- [ ] **Testing**
  - Unit tests for verification logic
  - Unit tests for claim generation
  - Integration test: end-to-end claim flow

---

### Phase 1.4: Database Seeding (Optional)

- [ ] **Create insurance provider seed data**
  - Pre-populate provider list for dropdowns
  - NHIS, VDRL, AXA, Hygeia, Glico, ALICO
  - Includes contact info, typical coverage %

- [ ] **Create sample test data**
  - Test patient with NHIS coverage
  - Test patient with private insurance
  - Test invoices linked to insurance

---

## WEEK 2: FRONTEND UI

### Phase 2.1: Patient Profile — Insurance Tab

- [ ] **Create component: `PatientInsuranceForm.tsx`**
  - Location: `src/components/patient/PatientInsuranceForm.tsx`
  - Inputs:
    - `insuranceActive` (toggle)
    - `insuranceProvider` (dropdown: NHIS, VDRL, AXA, etc.)
    - `insurancePolicyNo` (text)
    - `insuranceCoveragePercent` (dropdown: 50%, 60%, 70%, 80%, 100%)
    - `insuranceAnnualLimit` (number, GHS)
    - `insuranceVerifiedDate` (date, read-only)
    - `insuranceVerifiedBy` (text, read-only)
    - `insuranceNotes` (textarea)
    - `insuranceSecondary` (text)
  
  - Features:
    - Save button → PATCH `/api/patients/{id}`
    - Cancel button
    - Error toast on save failure
    - Show "Last verified: Jun 14, 2026 by Ama Asante"

- [ ] **Integrate into Patient Edit Modal**
  - Location: Patient list page + patient detail page
  - Add tab: "Insurance" alongside "Contact", "Medical History"
  - Show insurance summary if active (provider, coverage %, status)

- [ ] **Add Patient List Column**
  - Show insurance provider icon/badge in patient table
  - Quick indicator: "NHIS (70%)" or "No insurance"

- [ ] **Testing**
  - Add insurance to patient
  - Edit insurance info
  - Verify save/cancel works
  - Verify form validation

---

### Phase 2.2: Appointments — Insurance Pre-Check

- [ ] **Create component: `AppointmentInsuranceStatus.tsx`**
  - Location: `src/components/appointment/AppointmentInsuranceStatus.tsx`
  - Display:
    - Provider name
    - Policy number
    - Coverage percentage
    - "Eligible?" badge (Yes/No/Unknown)
    - Estimated clinic cost
    - Estimated patient cost (100% - coverage%)
  
  - Buttons:
    - "Verify Eligibility" → opens verification modal
    - "Add Notes" → opens notes editor

- [ ] **Create modal: `InsuranceVerificationModal.tsx`**
  - Inputs:
    - Verification method (dropdown: Manual/Phone/SMS/Portal)
    - Eligible? (Yes/No)
    - Coverage % (auto-filled from patient record)
    - Annual limit (GHS)
    - Notes (textarea)
  - Save button → calls `POST /api/insurance-verification`
  - Shows timestamp + verified-by info

- [ ] **Integrate into Appointment Details Page**
  - Show insurance status card above appointment notes
  - Accessible from appointment list (expand row)
  - Pre-fill based on patient's linked insurance

- [ ] **Testing**
  - Verify eligibility for appointment
  - Update coverage %
  - Check notes saved correctly

---

### Phase 2.3: Invoices — Enhanced Insurance Claims Form

- [ ] **Enhance existing `/insurance` page**
  - Already shows claims list
  - Add "Generate PDF" button per claim
  - Add "Email to Insurer" button per claim

- [ ] **Enhance claim edit form**
  - Add fields:
    - `insuranceParNumber` (text, optional)
    - `insuranceParApprovedAmount` (number, GHS)
    - `insuranceDiagnosisCode` (text: ICD-10)
    - `insuranceServiceCode` (text: NHIS code)
    - `insurancePatientLiability` (read-only, calculated)
  
  - UI:
    - Pre-fill PAR amount if applicable
    - Auto-calculate patient liability below form
    - Show: "Patient owes: GHS X after insurance"

- [ ] **Create "Add Claim" workflow enhancement**
  - When user clicks "Add Claim" on invoice:
    - Pre-fill provider from patient record
    - Pre-fill policy number from patient record
    - Pre-fill coverage % from patient record
    - Show eligibility verification status
    - Suggest claimed amount = (invoice * coverage%)
    - Option to adjust claimed amount manually

- [ ] **Testing**
  - Add claim to invoice with PAR
  - Verify patient liability calculated correctly
  - Edit claim and verify changes persist

---

### Phase 2.4: Reports & Dashboard

- [ ] **Create Insurance Summary Dashboard**
  - Location: New route `/finance/insurance-summary`
  - Display:
    - This month claims: count + total GHS
    - Pending claims (count + GHS)
    - Approved claims (count + GHS)
    - Rejected claims (count)
    - Average turnaround: X days
    - Claims by provider (chart)
    - Claims by status (pie chart)
    - Top patients by insurance usage
  
  - Export: Download as CSV/PDF

- [ ] **Insurance Sidebar Widget**
  - Show in finance dashboard
  - Quick stats: "3 claims pending, GHS 1,200"
  - Link to full insurance page

- [ ] **Testing**
  - Generate test claims, verify calculations
  - Export dashboard data
  - Check responsive design

---

## WEEK 3: INTEGRATION & TESTING

### Phase 3.1: Claim Submission Features

- [ ] **Create `generateClaimPDF` function**
  - Input: invoiceId, claimId
  - Output: PDF bytes with:
    - Patient info (name, card number, DOB)
    - Clinic info (name, license, address, bank account)
    - Invoice details (service, cost, date)
    - Diagnosis & service codes
    - PAR reference (if applicable)
    - Claim amount
    - Clinic stamp placeholder
    - Signature line
  
  - Library: Use `pdfkit` or `jsPDF`
  - Test: Generate sample PDF

- [ ] **Create "Generate PDF" button in insurance page**
  - Endpoint: `GET /api/insurance-claims/{id}/pdf`
  - Downloads claim PDF with proper filename
  - Test: Download & verify PDF quality

- [ ] **Create "Email to Insurer" pre-fill helper**
  - Button in insurance page
  - Pre-populates:
    - To: insurer email (from provider config)
    - Subject: "Dental Claim — {PatientName} ({Card#})"
    - Body: Template with claim details
  - Test with Gmail/Outlook
  - Provide copy-paste template for non-email systems

- [ ] **Create insurer contact directory**
  - UI: Modal or sidebar with all insurers
  - Shows:
    - NHIS: claims@nhis.gov.gh, 0800-900-900
    - VDRL: claims@vdrl.com.gh, 0302-400-400
    - AXA: healthclaims@axaghana.com, 0300-320-320
    - Hygeia: dental-claims@africanalliancegh.com, 0302-611-611
    - Glico: claims@glico.com.gh, 0303-937-937
    - ALICO: claims@alico-ghana.com, 0302-226-226
  
  - Accessible from claims form

---

### Phase 3.2: End-to-End Testing

- [ ] **Test Scenario 1: Simple NHIS Claim**
  1. Create patient with NHIS insurance
  2. Create appointment (GHS 200)
  3. Verify eligibility (70% coverage, active)
  4. Create invoice
  5. Add insurance claim (GHS 200 claimed, 70% expected)
  6. Generate PDF
  7. Update status to "APPROVED" (GHS 140)
  8. Verify patient liability calculated (GHS 60)

- [ ] **Test Scenario 2: PAR Pre-Authorization**
  1. Patient books major procedure (GHS 500)
  2. Create claim before service (status: PAR_REQUESTED)
  3. Enter PAR number + approved amount (GHS 400)
  4. Service completed, invoice created (GHS 500)
  5. Submit claim (claimed GHS 500, but PAR says GHS 400)
  6. Claim approved for GHS 400
  7. Patient liability: GHS 100 (GHS 500 - GHS 400)

- [ ] **Test Scenario 3: Multiple Insurances**
  1. Patient has NHIS + private insurance
  2. Book procedure (GHS 300)
  3. Submit to NHIS (70% = GHS 210)
  4. NHIS approves GHS 200 (less than 70%)
  5. Patient liability: GHS 100 + excess (GHS 10)
  6. Option to claim difference with secondary insurance

- [ ] **Test Scenario 4: Claim Rejection & Resubmission**
  1. Submit claim
  2. Status updated to REJECTED (bad diagnosis code)
  3. Staff corrects diagnosis code
  4. Resubmit (create new claim record)
  5. Track both versions in history

- [ ] **Load Testing**
  - Generate 1000 test claims
  - Verify dashboard performance
  - Check database query speeds

- [ ] **Browser Testing**
  - Chrome, Safari, Firefox, mobile
  - PDF generation across browsers
  - Form validation on all devices

---

### Phase 3.3: Documentation & Training

- [ ] **Create User Guide (2 pages PDF)**
  - "How to submit insurance claims in Nexus Dental"
  - Step 1: Add insurance to patient
  - Step 2: Verify eligibility before appointment
  - Step 3: Create claim after invoice
  - Step 4: Submit to insurer (email or portal)
  - Step 5: Track status in dashboard

- [ ] **Create Video Walkthroughs**
  - Video 1: Adding patient insurance (1 min)
  - Video 2: Verifying eligibility (1 min)
  - Video 3: Creating & submitting claim (2 min)
  - Video 4: Dashboard overview (1 min)
  - Upload to YouTube, embed in help docs

- [ ] **Create FAQ Document**
  - Q: "What's the difference between NHIS and private insurance?"
  - Q: "How long do claims take to be approved?"
  - Q: "What if the insurer rejects the claim?"
  - Q: "Can a patient have multiple insurances?"
  - Q: "What's a PAR number?"
  - Q: "How do I collect the patient's out-of-pocket cost?"

- [ ] **Create Insurer Setup Guide**
  - For clinic owner/manager
  - Steps to register with NHIS (3-5 weeks)
  - Steps to register with VDRL, AXA, etc. (2-4 weeks per insurer)
  - What to expect from each insurer

- [ ] **Create Troubleshooting Guide**
  - "Claim marked PENDING but been 7 days" → contact insurer
  - "Insurer asks for diagnosis code" → find ICD-10 code, resubmit
  - "Policy number doesn't match insurer records" → ask patient to verify

- [ ] **Update API Documentation**
  - Document new endpoints in `/docs` or README
  - Example requests/responses
  - Error codes & meanings

---

### Phase 3.4: Security & Compliance

- [ ] **Data Privacy Review**
  - Insurance info is sensitive → ensure PII protected
  - Access control: Only billing staff can see insurance details
  - Audit logging: Log all insurance data access

- [ ] **Permission Checks**
  - Only `BILLING_STAFF` or `ADMIN` can:
    - View insurance info
    - Verify eligibility
    - Create/edit claims
    - Download PDFs
  - `DOCTOR` can view (read-only)
  - `PATIENT` cannot see insurance claims list (only their own)

- [ ] **Add Audit Logging**
  - Log patient insurance changes
  - Log claim creation/update
  - Log PDF generation
  - Log email sending (timestamp only, not email content)

- [ ] **Encryption**
  - Policy numbers stored in plain text is OK (not highly sensitive)
  - But ensure database backups encrypted at rest

- [ ] **GDPR/Data Retention**
  - Define retention period: Keep claim data 5 years (per Ghana law)
  - Soft delete claims (add deletedAt field if not present)
  - Anonymous data for analytics

---

### Phase 3.5: Performance Optimization

- [ ] **Database Indexes**
  - Verify indexes added:
    - `Invoice.insuranceClaimStatus`
    - `InsuranceClaim.status`
    - `InsuranceClaim.tenantId`
    - Patient insurance lookup: `(tenantId, insuranceActive)`

- [ ] **API Query Optimization**
  - Claims list endpoint: Use pagination (50 per page)
  - Pre-load patient insurance data
  - Cache provider list in memory

- [ ] **Frontend Performance**
  - Lazy-load insurance components
  - Debounce verification form inputs
  - Optimize PDF generation (async in background)

---

## WEEK 4: LAUNCH & MONITORING

### Phase 4.1: Pre-Launch Checklist

- [ ] **Code Review**
  - All code reviewed by senior engineer
  - No hardcoded secrets (use env vars)
  - No console.log in production code

- [ ] **QA Sign-off**
  - All test scenarios pass
  - No critical bugs
  - Performance acceptable

- [ ] **Deployment**
  - Database migration applied to production
  - New environment variables set
  - Feature flags enabled for beta testing
  - Rollback plan documented

- [ ] **Monitoring Setup**
  - Error tracking (Sentry) enabled
  - Database query monitoring
  - API latency monitoring
  - Alert rules set for errors

- [ ] **Customer Communication**
  - Clinic owners notified of new feature
  - Training materials sent
  - Email support contact provided

---

### Phase 4.2: Pilot Clinic Testing

- [ ] **Select 2-3 pilot clinics**
  - Mix of NHIS + private insurance users
  - Experienced with Nexus system

- [ ] **Onboarding**
  - Schedule 30-min training call
  - Walk through insurance setup
  - Have them test with sample patient/appointment

- [ ] **Monitoring**
  - Daily check-ins for first week
  - Track any bugs reported
  - Collect feedback on UX
  - Monitor error logs from their tenant

- [ ] **Feedback Incorporation**
  - Fix any critical bugs immediately
  - Document feature requests for Phase 2
  - Update docs based on feedback

---

### Phase 4.3: Full Rollout

- [ ] **Feature Flag Rollout**
  - Enable for 10% of clinics (monitoring)
  - Enable for 50% of clinics (after 3 days)
  - Enable for 100% of clinics (after 1 week, no issues)

- [ ] **Marketing/Comms**
  - Blog post: "Insurance claims in Nexus Dental"
  - Email to all clinic owners
  - In-app notification: New feature available

- [ ] **Support Preparation**
  - Support team trained on insurance features
  - FAQ updated
  - Escalation path for complex issues

- [ ] **Monitoring Dashboards**
  - Insurance claims created per day
  - PDF generation success rate
  - API error rates
  - User adoption metrics

---

### Phase 4.4: Post-Launch (First 4 Weeks)

- [ ] **Daily Monitoring**
  - Check error logs
  - Monitor for performance degradation
  - Watch for support tickets related to insurance

- [ ] **Weekly Metrics Review**
  - Number of clinics using feature
  - Average claims per clinic
  - Claim approval rates by insurer
  - User feedback summary

- [ ] **Bug Fixes**
  - Prioritize any reported issues
  - Deploy patches immediately if critical
  - Document all fixes for Phase 2

- [ ] **Feedback Collection**
  - Send survey to pilot clinics: "How did it go?"
  - Interview 3-4 clinics on UX improvements
  - Compile feedback for Phase 2 roadmap

---

## APPENDIX: DELIVERABLES CHECKLIST

### Code Deliverables
- [ ] Prisma migrations (database schema)
- [ ] API endpoints (verification, claims enhancement)
- [ ] Service layer functions (verification, PDF generation)
- [ ] React components (patient insurance form, claim form, dashboard)
- [ ] Unit & integration tests
- [ ] API documentation

### Documentation Deliverables
- [ ] User guide (2 pages)
- [ ] Troubleshooting guide
- [ ] Insurer setup guide
- [ ] FAQ document
- [ ] Admin onboarding materials
- [ ] Video walkthroughs (4x 1-2 min videos)

### Infrastructure Deliverables
- [ ] Database migration scripts
- [ ] Environment variables documentation
- [ ] Feature flag configuration
- [ ] Monitoring/alerting rules
- [ ] Rollback procedures

### Training Deliverables
- [ ] Clinic owner briefing (email)
- [ ] Support team training (call)
- [ ] Video tutorials (embedded in app)
- [ ] Live Q&A session (optional)

---

## RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| **Week 1 slips** | Start migration early; have backup plan if DB changes delayed |
| **API bugs block testing** | Build mock insurance provider service for local testing |
| **Insurers require different fields** | Build extensible claim form; use JSON for provider-specific metadata |
| **PDF generation slow** | Use serverless function or background job (BullMQ) |
| **High support tickets** | Pre-write FAQ; have support escalation path ready |
| **Performance issues** | Use database indexing + query monitoring; lazy-load components |
| **Feature creep** | Stick to MVP scope; document Phase 2 feature requests separately |

---

**Timeline Summary:**
- **Week 1:** Database + Backend (Dec 5-7 hours of engineering)
- **Week 2:** Frontend + UI (3-5 hours of engineering)
- **Week 3:** Integration + Testing (3-4 hours of QA + engineering)
- **Week 4:** Launch + Monitoring (2-3 hours of DevOps + Support)

**Total Effort:** ~13-19 engineering hours + 5-10 QA hours = **18-29 person-hours**

**Launch Target:** Early July 2026
