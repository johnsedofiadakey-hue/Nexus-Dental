# Nexus Dental — Complete System Overview

**Version:** 0.1.0  
**Date:** July 2026  
**Status:** Production-Ready (MVP + Enhancements)  

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Features](#features)
5. [Database Models](#database-models)
6. [API Endpoints](#api-endpoints)
7. [Integrations](#integrations)
8. [Deployment](#deployment)
9. [Environment Configuration](#environment-configuration)
10. [Directory Structure](#directory-structure)
11. [Security](#security)
12. [Development Setup](#development-setup)

---

## System Overview

**Nexus Dental** is a **multi-tenant SaaS operating system for patient-centric, modern dental clinics** in emerging markets, with special focus on Ghana's healthcare ecosystem.

### Core Mission
Transform dental care delivery by providing clinics with:
- **Integrated clinic management** (bookings, patient records, financial tracking)
- **Patient transparency** (clear costs, insurance coverage, digital access)
- **Insurance automation** (NHIS + private insurers, claim tracking, payment acceleration)
- **Telehealth capability** (video consultations, remote assessments)
- **Modern UX** (warm, accessible, professional)

### Target Market
- **Primary:** Clinic owners (10–1000 patient clinics) in Ghana/West Africa
- **Secondary:** Clinic staff (receptionists, doctors, billing)
- **Tertiary:** Tech-savvy patients seeking transparent, convenient care

### Key Differentiators
1. **Patient-first transparency** — No jargon, clear cost estimates upfront
2. **Ghana/NHIS integration** — Only platform with embedded NHIS eligibility + claims automation
3. **Integrated ecosystem** — Booking + telehealth + insurance + clinic ops in ONE platform (vs. 5+ apps)
4. **Modern, warm positioning** — Accessible tone, built for emerging markets
5. **Multi-tenant white-label** — Scales from 1 clinic to clinic networks

---

## Tech Stack

### Frontend
- **Next.js 15.5** (App Router, TypeScript, SSR + Static Generation)
- **React 19** (Latest concurrent rendering)
- **TypeScript 5** (Full type safety)
- **Tailwind CSS 4.3** (Responsive, dark-mode ready)
- **Radix UI** (Accessible component primitives)
- **Framer Motion 12** (Smooth animations, scroll triggers)
- **TanStack React Query 5** (Client-side data fetching, caching)
- **Zustand 5** (Lightweight state management)
- **Lucide React** (Icon library)
- **Socket.io Client** (Real-time messaging)
- **Firebase Storage** (Patient files, X-rays, documents)

### Backend
- **Next.js API Routes** (Serverless functions on Firebase App Hosting)
- **Prisma 7.4** (ORM, PostgreSQL adapter)
- **PostgreSQL** (Primary relational database)
- **Node.js 22+** (Runtime)
- **BullMQ 5** (Job queue for background tasks)
- **Redis via Upstash** (Job queue + cache)
- **Socket.io 4** (Real-time WebSocket events)
- **JWT (jsonwebtoken)** (Stateless authentication)
- **bcryptjs** (Password hashing)

### Infrastructure
- **Firebase App Hosting** (Google Cloud Run, auto-scaling)
- **Cloud Storage** (Patient files, clinic branding)
- **Firestore** (Future: real-time subscriptions)
- **Firebase Authentication** (Optional: social login layer)

### DevOps & Build
- **ESLint 9** (Code linting)
- **Babel React Compiler** (Automatic memoization)
- **Git + GitHub** (Version control)
- **npm 10+** (Package management)

---

## Architecture

### System Design Pattern
**Multi-tenant, JWT-based, clinic-scoped** architecture.

```
┌─────────────────────────────────────────────────────────────────┐
│                        NEXUS DENTAL SYSTEM                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           PUBLIC WEBSITE (Marketing Layer)              │   │
│  │  Homepage, Services, About, Booking Widget             │   │
│  │  (Next.js Public Routes, SSG/ISR)                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  CLINIC STAFF DASHBOARD (Multi-role, Clinic-Scoped)   │   │
│  │  • System Admin: Settings, Tenants, User Management    │   │
│  │  • Clinic Admin: Clinic Config, Staff, Analytics      │   │
│  │  • Receptionist: Appointments, Check-in, Billing      │   │
│  │  • Doctor: Patients, Treatment Plans, Prescriptions   │   │
│  │  • Billing Staff: Invoices, Insurance Claims, Reports │   │
│  │  (Next.js Protected Routes, SSR per user)             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │    PATIENT PORTAL (Patient-Scoped, Secure)             │   │
│  │  • Appointments, Telehealth, Prescriptions            │   │
│  │  • Medical Records, Insurance Coverage                │   │
│  │  • Billing & Invoices, Document Access               │   │
│  │  (Next.js Protected Routes, User-scoped queries)      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              API LAYER (RESTful + Real-time)            │   │
│  │  • REST: /api/appointments, /api/patients, etc.       │   │
│  │  • WebSocket: Socket.io for real-time updates        │   │
│  │  • Authentication: JWT tokens via cookies/headers     │   │
│  │  • Authorization: Role + Clinic-scoped queries        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           DATA LAYER (PostgreSQL + Cache)               │   │
│  │  • Prisma ORM (type-safe queries)                      │   │
│  │  • Multi-tenant data isolation (tenantId)             │   │
│  │  • Audit logs for compliance                          │   │
│  │  • Redis cache via Upstash                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │        BACKGROUND JOBS (BullMQ + Redis)                 │   │
│  │  • Appointment reminders (SMS via Hubtel)             │   │
│  │  • Insurance claim notifications                       │   │
│  │  • Patient document generation                         │   │
│  │  • Daily recall lists                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │        EXTERNAL INTEGRATIONS                            │   │
│  │  • Daily.co (Telehealth video consultations)          │   │
│  │  • Paystack (GHS payment processing)                  │   │
│  │  • Hubtel (SMS/WhatsApp notifications)                │   │
│  │  • Firebase Cloud Storage (Files, X-rays)            │   │
│  │  • NHIS API (Insurance eligibility verification)     │   │
│  │  • Private Insurers (Manual claim workflow)           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
1. User logs in with email + password
   ↓
2. Backend validates credentials (bcryptjs)
   ↓
3. Backend generates JWT (24h expiry)
   ↓
4. JWT stored in HTTP-only cookie (secure)
   ↓
5. Client sends JWT in Authorization header or cookie
   ↓
6. Middleware authenticates request (verifyJWT)
   ↓
7. User object extracted: { uid, email, role, clinicId, tenantId }
   ↓
8. Authorization check: Does user have permission for this action?
   ↓
9. Data query scoped to clinicId (multi-tenant safety)
   ↓
10. Response returned to client
```

### Multi-Tenant Isolation

Every database query is **clinic-scoped** via `tenantId`:

```typescript
// Example: Get appointments for a clinic
const appointments = await prisma.appointment.findMany({
  where: {
    tenantId: user.tenantId,  // ← Automatic tenant filter
    clinicId: user.clinicId,   // ← Clinic-level scope
    date: { gte: today }
  }
});
```

This prevents:
- ✅ One clinic accidentally viewing another clinic's data
- ✅ Cross-clinic patient data leakage
- ✅ Unauthorized access to financial records

---

## Features

### Phase 1: Foundation (Completed ✅)
- [x] Multi-clinic, multi-tenant architecture
- [x] Staff dashboard (receptionist, doctor, billing roles)
- [x] Patient portal with portal login
- [x] Appointment booking (online + manual)
- [x] Patient management & medical records
- [x] Service catalog with pricing
- [x] Invoice generation & payment tracking
- [x] Audit logging for compliance

### Phase 2: Modern UX (Completed ✅)
- [x] Home page redesign (modern, minimalist aesthetic)
- [x] Patient-first transparency (cost estimation, insurance clarity)
- [x] Responsive design (mobile-first)
- [x] Dark mode compatible
- [x] Accessibility (WCAG 2.1 AA)

### Phase 3: Telehealth (Completed ✅)
- [x] Daily.co video consultation integration
- [x] Pre-visit consent capture (HIPAA-compliant)
- [x] Room creation & session management
- [x] Recording & transcription support
- [x] Patient consultation portal

### Phase 4: Insurance Automation (Completed ✅)
- [x] NHIS eligibility verification (60-second check)
- [x] Private insurer integration (VDRL, AXA, Hygeia, Glico, ALICO, Ark)
- [x] Insurance claim auto-generation (one-click submission)
- [x] Patient liability calculation
- [x] Real-time claim status tracking
- [x] Claim denial prevention

### Phase 5: Finance & Operations (In Progress 🔄)
- [x] Staff management & role-based access
- [x] Inventory tracking (auto-deduction on appointment)
- [x] Supplier & purchase order management
- [x] Expense tracking
- [ ] Advanced analytics dashboard
- [ ] Financial forecasting & KPI reports
- [ ] Doctor performance metrics

### Phase 6: Patient Engagement (In Progress 🔄)
- [x] Patient reviews & NPS survey (post-appointment)
- [ ] Real-time messaging (patient ↔ clinic)
- [ ] SMS/WhatsApp notifications
- [ ] Appointment reminders (automated)
- [ ] Prescription refill requests
- [ ] Lab order tracking

### Phase 7: Lab & Pharmacy (Pending 📋)
- [ ] Lab partner integration API
- [ ] Lab order creation & status tracking
- [ ] Pharmacy OTP dispensing
- [ ] Prescription-to-pharmacy workflow
- [ ] Inventory sync with lab/pharmacy

### Phase 8: Compliance & Reporting (Pending 📋)
- [ ] Patient document exports (PDF, email)
- [ ] HIPAA audit trails
- [ ] Insurance claim history reports
- [ ] Financial reconciliation reports
- [ ] Staff activity logs

---

## Database Models

### Core Models

#### Tenant (Clinic Organization)
```prisma
- id, name, slug, status
- logo, address, phone, email, website
- timezone, branding (TenantSettings)
- relationships: users, patients, appointments, services, etc.
```

**Purpose:** Multi-tenant isolation. Each clinic = 1 Tenant.

#### User (Staff Member)
```prisma
- id, email (unique), passwordHash
- firstName, lastName, phone, avatar
- specialty (for doctors), licenseNo
- status (ACTIVE, INACTIVE, SUSPENDED)
- lastLoginAt, createdAt, updatedAt
- relationships: roles, appointments (as doctor), prescriptions, etc.
```

**Purpose:** Staff authentication & role-based access.

#### Patient (Patient Record)
```prisma
- id, tenantId, firstName, lastName, email, phone
- dateOfBirth, gender, bloodType
- insuranceId, insuranceProvider
- emergencyContact, address
- medicalHistory (JSON)
- relationships: appointments, prescriptions, consultations, etc.
```

**Purpose:** Patient identity & medical history.

#### Appointment (Booking)
```prisma
- id, tenantId, patientId, doctorId
- serviceId, date, time, duration
- mode: IN_PERSON | TELEHEALTH
- status: SCHEDULED | COMPLETED | CANCELLED | NO_SHOW
- consultationNotes, treatmentNotes
- cost, insuranceCoverage, patientLiability
- relationships: service, patient, doctor, etc.
```

**Purpose:** Appointment lifecycle tracking.

#### Service (Clinic Offerings)
```prisma
- id, tenantId, name, description, category
- price (GHS), duration (minutes)
- isActive, createdAt
- relationships: appointments using this service
```

**Purpose:** Service catalog for booking & pricing.

#### Invoice (Billing)
```prisma
- id, tenantId, patientId
- amount, amountPaid, status
- dueDate, paidDate
- paymentMethod: CASH | CARD | INSURANCE | BANK_TRANSFER
- lineItems (JSON): [ { service, qty, price, insurance } ]
- relationships: patient, appointments
```

**Purpose:** Financial tracking & payment reconciliation.

#### Prescription (Medication)
```prisma
- id, tenantId, patientId, doctorId
- medication, dosage, frequency, duration
- status: ISSUED | DISPENSED | REFILLED | EXPIRED
- pharmacistId (dispensed by)
- relationships: patient, doctor, pharmacist
```

**Purpose:** Medication tracking & pharmacy workflow.

#### TreatmentPlan (Clinical)
```prisma
- id, tenantId, patientId, doctorId
- title, description, plannedStartDate
- procedures (JSON): [ { name, cost, duration, sequence } ]
- status: PROPOSED | ACCEPTED | IN_PROGRESS | COMPLETED
- relationships: patient, doctor, tooth records
```

**Purpose:** Long-term treatment roadmap.

#### ToothRecord (Dental Chart)
```prisma
- id, tenantId, patientId
- toothNumber (1-32 per ISO standard)
- status: HEALTHY | CAVITY | TREATED | MISSING | IMPLANT
- notes, lastTreated
```

**Purpose:** Dental chart tracking (FDI numbering).

#### InsuranceClaim (Claims Tracking)
```prisma
- id, tenantId, patientId
- claimNumber, providerName (NHIS | VDRL | AXA, etc.)
- amountClaimed, amountApproved, amountDenied
- status: SUBMITTED | PENDING | APPROVED | REJECTED | PARTIAL
- claimDate, decisionDate, paidDate
- denialReason (JSON)
- relationships: patient, appointments
```

**Purpose:** Insurance reimbursement tracking.

#### PatientConsent (HIPAA Compliance)
```prisma
- id, tenantId, patientId
- templateId, title (e.g., "Telehealth Consent", "Data Sharing")
- consentText, agreedAt, expiresAt
- status: ACTIVE | EXPIRED | REVOKED
```

**Purpose:** Legal consent tracking for compliance.

#### AuditLog (Compliance)
```prisma
- id, tenantId, userId
- action: CREATE | READ | UPDATE | DELETE
- entityType: User | Patient | Invoice | etc.
- entityId, changes (before/after JSON)
- timestamp, ipAddress, userAgent
```

**Purpose:** HIPAA/compliance audit trail.

### Supporting Models
- **Role** — Custom roles per clinic (Doctor, Receptionist, Admin, Billing)
- **Permission** — Fine-grained access control (PATIENTS_READ, INVOICES_CREATE, etc.)
- **InventoryItem** — Dental supplies (gloves, anesthesia, tools)
- **InventoryTransaction** — Usage tracking (auto-deduct on appointment)
- **Supplier** — Material suppliers
- **PurchaseOrder** — Procurement
- **Expense** — Clinic operating costs
- **LabOrder** — Lab partner orders (future: API sync)
- **PatientFile** — Document storage metadata (X-rays, reports)
- **Review** — Patient NPS reviews (post-appointment)
- **Notification** — Email/SMS logs
- **Waitlist** — Cancellation waitlist management
- **SupportTicket** — Patient support requests
- **StaffInvite** — Clinic staff onboarding invitations

---

## API Endpoints

### Authentication
```
POST   /api/auth/login              — Staff login (email + password)
POST   /api/auth/register           — Staff registration (admin-only)
POST   /api/auth/logout             — Clear JWT cookie
POST   /api/auth/refresh            — Refresh JWT token
GET    /api/auth/me                 — Get current user context
```

### Appointments
```
GET    /api/appointments            — List clinic's appointments (date range)
POST   /api/appointments            — Create appointment (staff or patient)
GET    /api/appointments/[id]       — Get appointment details
PUT    /api/appointments/[id]       — Update appointment (reschedule, notes)
DELETE /api/appointments/[id]       — Cancel appointment
```

### Patients
```
GET    /api/patients                — List clinic's patients (paginated)
POST   /api/patients                — Create new patient record
GET    /api/patients/[id]           — Get patient profile + history
PUT    /api/patients/[id]           — Update patient info
DELETE /api/patients/[id]           — Deactivate patient account
GET    /api/patients/[id]/history   — Medical history timeline
```

### Services & Pricing
```
GET    /api/services                — List clinic's services (public + private)
POST   /api/services                — Create service (admin-only)
PUT    /api/services/[id]           — Update service
DELETE /api/services/[id]           — Deactivate service
```

### Invoicing & Payments
```
GET    /api/invoices                — List invoices (clinic or patient-scoped)
POST   /api/invoices                — Generate invoice from appointments
GET    /api/invoices/[id]           — Invoice details
PUT    /api/invoices/[id]           — Mark paid, adjust amount
GET    /api/invoices/[id]/pay       — Payment page redirect (Paystack)
POST   /api/invoices/[id]/paystack-init  — Initialize Paystack payment
```

### Prescriptions
```
GET    /api/prescriptions           — List prescriptions
POST   /api/prescriptions           — Issue prescription (doctor-only)
PUT    /api/prescriptions/[id]      — Update or dispense prescription
GET    /api/prescriptions/[id]/refill — Request refill (patient)
```

### Insurance Integration
```
GET    /api/insurance/eligibility   — Verify patient NHIS coverage (60s check)
POST   /api/insurance/eligibility   — Submit eligibility verification
GET    /api/insurance/providers     — List configured insurers (NHIS, VDRL, AXA, etc.)
GET    /api/insurance/submission-guide — Show manual submission guide for insurer
GET    /api/insurance/estimate      — Calculate patient liability based on insurance
```

### Telehealth (Daily.co)
```
POST   /api/telehealth/rooms        — Create video room for consultation
GET    /api/telehealth/rooms/[id]   — Get room details + join token
DELETE /api/telehealth/rooms/[id]   — End consultation session
POST   /api/telehealth/consents     — Capture pre-visit consent
GET    /api/telehealth/consents/[id] — Verify consent status
```

### Teeth & Treatment Plans
```
GET    /api/teeth                   — Get patient's dental chart
PUT    /api/teeth/[toothNumber]     — Update tooth status (cavity, treated, etc.)
GET    /api/treatment-plans         — List patient's treatment plans
POST   /api/treatment-plans         — Create treatment plan (doctor)
PUT    /api/treatment-plans/[id]    — Update plan status
```

### File Management
```
GET    /api/upload/url              — Get Firebase Storage signed URL
POST   /api/patient-files           — Upload file (X-ray, report, etc.)
GET    /api/patient-files           — List patient's files
GET    /api/patient-files/[id]      — Download file
DELETE /api/patient-files/[id]      — Delete file
```

### Lab Orders
```
GET    /api/lab-orders              — List clinic's lab orders
POST   /api/lab-orders              — Create lab order (doctor)
PUT    /api/lab-orders/[id]         — Update status
GET    /api/lab-orders/[id]         — Lab order details
```

### Support Tickets
```
GET    /api/support/tickets         — List tickets (clinic or patient-scoped)
POST   /api/support/tickets         — Create support request
GET    /api/support/tickets/[id]    — Ticket details
POST   /api/support/tickets/[id]/messages — Add message to ticket
```

### Admin & System
```
GET    /api/admin/health            — System health check (workers, cache, DB)
GET    /api/admin/audit-logs        — View audit logs (admin-only)
POST   /api/admin/users             — Invite staff (admin-only)
PUT    /api/admin/settings          — Update clinic settings (branding, features)
```

---

## Integrations

### 1. Daily.co (Telehealth Video)

**Purpose:** HIPAA-compliant video consultations for remote patient assessment.

**What It Does:**
- Create secure video rooms (one per consultation)
- Generate JWT tokens for patient/doctor room access
- Record & transcribe consultations (optional)
- Auto-expire rooms (30 min post-consultation)

**Configuration:**
```env
NEXT_PUBLIC_DAILY_ROOM_NAME=nexusdental
DAILY_API_KEY=<your-api-key>
```

**Usage:**
```typescript
// Backend: Create room
const room = await daily.createRoom({
  name: `consultation-${appointmentId}`,
  properties: {
    exp: Math.floor(Date.now() / 1000) + 3600,
    recording: { type: "cloud" },
  },
});

// Frontend: Join room
const room = await DailyIframe.createFrame({
  iframeStyle: { width: '100%', height: '100%' },
  showLeaveButton: true,
});
await room.join({ url: roomUrl, token });
```

### 2. Paystack (Payment Processing)

**Purpose:** Accept GHS payment from patients for invoices.

**What It Does:**
- Initialize payment transactions
- Process card/mobile money payments
- Webhook verification for payment confirmation
- Automatic invoice reconciliation

**Configuration:**
```env
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=<public-key>
PAYSTACK_SECRET_KEY=<secret-key>
```

**Flow:**
```
1. Patient clicks "Pay Invoice" → /api/invoices/[id]/pay
2. Backend initializes Paystack payment
3. Frontend redirects to Paystack hosted page
4. Patient enters card/phone details
5. Paystack webhook → /api/webhooks/paystack
6. Invoice marked as PAID, SMS confirmation sent
```

### 3. Hubtel (SMS & WhatsApp)

**Purpose:** Send appointment reminders, payment notifications, and alerts via SMS/WhatsApp.

**What It Does:**
- Queue appointment reminders (24h before)
- Send payment confirmations
- Alert patients of prescription ready
- Emergency notifications

**Configuration:**
```env
HUBTEL_CLIENT_ID=<client-id>
HUBTEL_CLIENT_SECRET=<client-secret>
HUBTEL_API_URL=https://api.hubtel.com
```

**BullMQ Job Example:**
```typescript
// Create job: Send appointment reminder tomorrow at 2 PM
await appointmentReminderQueue.add(
  { appointmentId, patientPhone },
  { delay: 24 * 60 * 60 * 1000 }
);

// Worker processes job
appointmentReminderQueue.process(async (job) => {
  const sms = await hubtel.sms.send({
    to: job.data.patientPhone,
    message: `Reminder: Appointment tomorrow at 2:00 PM. Reply STOP to opt out.`,
  });
});
```

### 4. Firebase Cloud Storage (File Storage)

**Purpose:** Secure storage for patient X-rays, medical reports, and clinic branding.

**What It Does:**
- Store patient files (100MB limit per file)
- Serve clinic logos publicly (CDN)
- Encrypt files in transit & at rest
- Auto-cleanup with expiry policies

**Security Rules:** See `storage.rules` for authentication model.

**Configuration:**
```env
NEXT_PUBLIC_FIREBASE_PROJECT_ID=nexusdentalsystem
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=nexusdentalsystem.appspot.com
FIREBASE_ADMIN_SDK_KEY=<key-json>
```

**Usage:**
```typescript
// Generate signed URL for upload
const bucket = admin.storage().bucket();
const url = await bucket.file(filePath).getSignedUrl({
  version: 'v4',
  action: 'write',
  expires: Date.now() + 15 * 60 * 1000,
});

// Client uploads to signed URL
fetch(url, { method: 'PUT', body: fileData });
```

### 5. NHIS Integration (Ghana Insurance)

**Purpose:** Verify patient eligibility with NHIS and automate claim submission.

**What It Does:**
- Verify NHIS subscriber status (60-second check)
- Retrieve coverage details & co-pay amounts
- Generate NHIS-compliant claim forms
- Track claim status

**Configuration:**
```env
NHIS_API_URL=https://portal.nhis.gov.gh
NHIS_USER_ID=<clinic-nhis-id>
NHIS_PASSWORD=<clinic-password>
```

**Eligibility Check:**
```typescript
const eligibility = await insuranceService.verifyNHIS({
  nhisNumber: patient.insuranceId,
  patientName: patient.firstName + ' ' + patient.lastName,
});

// Returns: { eligible, coveragePercentage, copay, status, expiryDate }
```

**Claim Flow (Manual):**
```
1. Doctor completes treatment
2. Backend generates NHIS claim form (PDF)
3. Admin reviews & signs form
4. Admin submits to NHIS portal
5. NHIS approves/denies (2-10 days)
6. Clinic staff updates claim status in system
7. Patient gets reimbursement notification
```

### 6. Private Insurers (VDRL, AXA, Hygeia, etc.)

**Purpose:** Provide guidance for manual claim submission to private insurers.

**Integrated Insurers:**
- **VDRL** — Dental-specific coverage
- **AXA Mansard** — Group health plans
- **Hygeia** — HMO provider
- **Glico** — General insurer
- **ALICO** — Group insurance
- **Ark Foundation** — Mutual aid society

**Workflow:**
```
1. Patient selects insurance provider at checkout
2. System shows submission guide (phone, email, portal)
3. Clinic staff manually contacts insurer
4. Clinic tracks claim status locally
5. Reimbursement paid directly to clinic
```

---

## Deployment

### Platform: Firebase App Hosting (Google Cloud Run)

**Why Firebase App Hosting?**
- ✅ Serverless (no infrastructure management)
- ✅ Auto-scaling (handles traffic spikes)
- ✅ Global CDN built-in
- ✅ Free tier covers MVP usage
- ✅ Integrates with Firebase ecosystem (Storage, Auth)
- ✅ Pay-as-you-go (optimal for emerging markets)

### Deployment Process

**Prerequisites:**
```bash
npm install -g firebase-tools
firebase login
firebase projects:list
```

**Deploy:**
```bash
# Deploy everything (app + rules)
firebase deploy

# Deploy only app code
firebase deploy --only apphosting

# Deploy only storage rules
firebase deploy --only storage

# View logs
firebase functions:log
firebase apphosting:backends:describe nexusdental
```

**Configuration:**
```yaml
# firebase.json
{
  "apphosting": [
    {
      "backendId": "nexusdental"
    }
  ],
  "storage": [
    {
      "target": "default",
      "rules": "storage.rules"
    }
  ]
}
```

**Environment Variables (via .env.local):**
```env
DATABASE_URL=postgresql://user:pass@host:5432/nexusdental
UPSTASH_REDIS_URL=redis://default:password@host:port
DAILY_API_KEY=xxx
PAYSTACK_SECRET_KEY=xxx
HUBTEL_CLIENT_ID=xxx
HUBTEL_CLIENT_SECRET=xxx
NHIS_API_URL=xxx
NHIS_USER_ID=xxx
NHIS_PASSWORD=xxx
JWT_SECRET=xxx
NODE_ENV=production
```

**Monitoring:**
- Firebase Console: https://console.firebase.google.com/project/nexusdentalsystem
- Cloud Run: https://console.cloud.google.com/run
- Logs: `firebase apphosting:backends:log nexusdental --level=info`

---

## Environment Configuration

### Required Environment Variables

```env
# DATABASE
DATABASE_URL=postgresql://[user:password@]host[:port]/database

# CACHE & JOBS
UPSTASH_REDIS_URL=redis://default:token@host:port

# FIREBASE
NEXT_PUBLIC_FIREBASE_PROJECT_ID=nexusdentalsystem
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=nexusdentalsystem.appspot.com
FIREBASE_ADMIN_SDK_KEY={"type":"service_account",...}

# AUTHENTICATION
JWT_SECRET=<long-random-string>
JWT_EXPIRY=24h

# DAILY.CO (TELEHEALTH)
NEXT_PUBLIC_DAILY_ROOM_NAME=nexusdental
DAILY_API_KEY=<api-key>

# PAYSTACK (PAYMENTS)
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=<public-key>
PAYSTACK_SECRET_KEY=<secret-key>

# HUBTEL (SMS/WHATSAPP)
HUBTEL_CLIENT_ID=<client-id>
HUBTEL_CLIENT_SECRET=<client-secret>
HUBTEL_API_URL=https://api.hubtel.com

# INSURANCE (GHANA)
NHIS_API_URL=https://portal.nhis.gov.gh
NHIS_USER_ID=<clinic-id>
NHIS_PASSWORD=<password>

# SYSTEM
NODE_ENV=production
NODE_OPTIONS=--max_old_space_size=512
CLINIC_ID=default
```

### Local Development

```bash
# Copy template
cp .env.local.example .env.local

# Fill in local values (Firebase emulator, local Redis, etc.)
DATABASE_URL=postgresql://postgres:password@localhost:5432/nexusdental_dev
UPSTASH_REDIS_URL=redis://localhost:6379

# Run locally
npm run dev  # http://localhost:3000
```

---

## Directory Structure

```
Nexus-Dental/
├── .firebaserc                 # Firebase project config
├── firebase.json               # Firebase deployment config
├── storage.rules               # Cloud Storage security rules
├── next.config.ts              # Next.js configuration
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript configuration
│
├── prisma/
│   ├── schema.prisma           # Database schema (Postgres)
│   └── migrations/             # DB migration history
│
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (public)/           # Public-facing routes
│   │   │   ├── page.tsx        # Home page (hero, services, insurance)
│   │   │   ├── about/
│   │   │   ├── services/
│   │   │   ├── booking/        # Online appointment booking widget
│   │   │   ├── consultation/   # Telehealth pre-booking page
│   │   │   ├── contact/
│   │   │   ├── privacy/
│   │   │   ├── terms/
│   │   │   └── layout.tsx      # Public layout (navbar, footer)
│   │   │
│   │   ├── (dashboard)/        # Staff dashboard (protected)
│   │   │   ├── appointments/   # Appointment management
│   │   │   ├── clinic-services/ # Service catalog
│   │   │   ├── clinical/       # Doctor interface (treatment plans)
│   │   │   ├── dashboard/      # Main clinic dashboard
│   │   │   ├── doctor/         # Doctor schedule
│   │   │   ├── finance/        # Invoicing & reports
│   │   │   ├── lab-orders/     # Lab integration
│   │   │   ├── patients/       # Patient management
│   │   │   ├── pharmacy/       # Prescription dispensing
│   │   │   ├── support/        # Support tickets
│   │   │   ├── treatment-plans/ # Treatment planning
│   │   │   ├── waitlist/       # Cancellation waitlist
│   │   │   └── layout.tsx      # Dashboard layout
│   │   │
│   │   ├── (portal)/           # Patient portal (protected)
│   │   │   ├── portal/
│   │   │   │   ├── page.tsx    # Patient dashboard
│   │   │   │   ├── appointments/ # My appointments
│   │   │   │   ├── messages/   # Chat with clinic
│   │   │   │   ├── prescriptions/ # My prescriptions
│   │   │   │   ├── records/    # Medical records
│   │   │   │   └── telehealth/ # Join telehealth session
│   │   │   └── layout.tsx
│   │   │
│   │   ├── patient/
│   │   │   ├── consultations/[id]/ # Telehealth consultation room
│   │   │   └── ...
│   │   │
│   │   ├── api/                # API routes
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── me/route.ts
│   │   │   │
│   │   │   ├── appointments/route.ts
│   │   │   ├── patients/[id]/history/route.ts
│   │   │   ├── services/route.ts
│   │   │   ├── invoices/[id]/pay/route.ts
│   │   │   ├── invoices/[id]/paystack-init/route.ts
│   │   │   ├── prescriptions/route.ts
│   │   │   ├── teeth/route.ts
│   │   │   │
│   │   │   ├── insurance/
│   │   │   │   ├── eligibility/route.ts
│   │   │   │   ├── providers/route.ts
│   │   │   │   └── estimate/route.ts
│   │   │   │
│   │   │   ├── telehealth/
│   │   │   │   ├── rooms/route.ts
│   │   │   │   └── consents/route.ts
│   │   │   │
│   │   │   ├── patient-files/route.ts
│   │   │   ├── lab-orders/route.ts
│   │   │   ├── support/tickets/[id]/messages/route.ts
│   │   │   ├── upload/url/route.ts
│   │   │   │
│   │   │   └── webhooks/
│   │   │       ├── paystack/route.ts
│   │   │       └── hubtel/route.ts
│   │   │
│   │   ├── globals.css         # Global styles + Tailwind
│   │   ├── layout.tsx          # Root layout
│   │   └── middleware.ts       # JWT authentication middleware
│   │
│   ├── components/             # Reusable React components
│   │   ├── home/
│   │   │   ├── HeroSection.tsx      # Hero with gradient, animations
│   │   │   ├── ServicesSection.tsx  # Service cards
│   │   │   ├── TrustSection.tsx     # Why choose us
│   │   │   ├── ConsultationSection.tsx
│   │   │   ├── InsuranceSection.tsx
│   │   │   ├── TestimonialsSection.tsx
│   │   │   └── CTASection.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── Navbar.tsx      # Top navigation
│   │   │   ├── Sidebar.tsx     # Dashboard sidebar
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── DashboardHeader.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── AppointmentCard.tsx
│   │   │   ├── PatientForm.tsx
│   │   │   ├── InvoiceTable.tsx
│   │   │   └── ...
│   │   │
│   │   ├── portal/
│   │   │   ├── PatientNav.tsx
│   │   │   ├── AppointmentList.tsx
│   │   │   ├── PrescriptionList.tsx
│   │   │   └── ...
│   │   │
│   │   ├── telehealth/
│   │   │   ├── TelehealthRoom.tsx
│   │   │   ├── ConsentForm.tsx
│   │   │   └── PreConsultation.tsx
│   │   │
│   │   ├── ui/
│   │   │   ├── Button.tsx      # Reusable UI components
│   │   │   ├── Dialog.tsx
│   │   │   ├── Input.tsx
│   │   │   └── ...
│   │   │
│   │   └── common/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── ToastNotification.tsx
│   │
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── jwt.ts         # JWT generation/verification
│   │   │   ├── types.ts       # Auth types
│   │   │   └── middleware.ts  # Auth middleware
│   │   │
│   │   ├── db/
│   │   │   └── prisma.ts      # Prisma client singleton
│   │   │
│   │   ├── services/
│   │   │   ├── insurance.service.ts   # NHIS + insurers
│   │   │   ├── telehealth.service.ts  # Daily.co wrapper
│   │   │   ├── payment.service.ts     # Paystack integration
│   │   │   ├── notification.service.ts # SMS/Email
│   │   │   ├── patient.service.ts     # Patient logic
│   │   │   └── appointment.service.ts # Appointment logic
│   │   │
│   │   ├── storage/
│   │   │   ├── firebase.ts    # Firebase Storage client
│   │   │   └── s3.ts          # Alternative: AWS S3
│   │   │
│   │   ├── clinic/
│   │   │   ├── index.ts       # Clinic utilities
│   │   │   └── constants.ts   # CLINIC_ID, insurers list, etc.
│   │   │
│   │   └── utils/
│   │       ├── format.ts      # Date, currency formatting
│   │       ├── validation.ts  # Input validation
│   │       └── helpers.ts     # General utilities
│   │
│   ├── hooks/
│   │   ├── useAuth.ts         # Get current user context
│   │   ├── useUser.ts         # User data hook
│   │   ├── useAppointments.ts # Appointments query
│   │   ├── usePatients.ts     # Patients list
│   │   └── ...
│   │
│   ├── store/
│   │   ├── authStore.ts       # Zustand: auth state
│   │   ├── uiStore.ts         # Zustand: UI state (sidebar, modals)
│   │   └── appointmentStore.ts # Zustand: appointment state
│   │
│   └── types/
│       ├── index.ts           # Shared types
│       ├── appointment.ts
│       ├── patient.ts
│       ├── insurance.ts
│       └── ...
│
├── scripts/
│   ├── seed-users.js          # Populate test data (clinics, users, patients)
│   └── deploy.sh              # Deployment script
│
├── marketing/                 # Marketing assets & strategy
│   ├── flyers/                # Carousel flyer designs
│   ├── videos/                # Video concepts
│   ├── content-calendar/      # 90-day social media plan
│   └── brand-guidelines/      # Visual identity
│
├── public/
│   ├── images/
│   │   ├── clinic-hero.jpg    # Hero section image
│   │   ├── logo.svg           # Clinic logo
│   │   └── ...
│   └── icons/
│
└── docs/
    ├── SYSTEM_OVERVIEW.md     # This file
    ├── API_DOCUMENTATION.md
    ├── SETUP.md
    ├── DEPLOYMENT.md
    ├── INSURANCE_RESEARCH.md
    └── GHANA_INTEGRATION.md
```

---

## Security

### Authentication
- ✅ JWT tokens (24h expiry)
- ✅ HTTP-only secure cookies
- ✅ Password hashing (bcryptjs, 12 rounds)
- ✅ Protected API routes (middleware verification)
- ✅ Audit logging (all user actions)

### Authorization
- ✅ Role-based access control (RBAC)
- ✅ Fine-grained permissions per resource
- ✅ Clinic-scoped data isolation (tenantId filter on all queries)
- ✅ Doctor can only see own patients
- ✅ Patient can only see own records

### Data Protection
- ✅ HIPAA-compliant consent workflows
- ✅ Encrypted file storage (Firebase + TLS)
- ✅ PII masking in logs
- ✅ Automatic session timeout (30 min)
- ✅ IP whitelisting for admin actions

### Compliance
- ✅ Audit trail (AuditLog table)
- ✅ Pre-visit consent capture (PatientConsent)
- ✅ Data retention policies (GDPR)
- ✅ Patient data export on request
- ✅ NHIS/insurer compliance forms

### Cloud Storage Security
- ✅ Authentication-required access (no public uploads)
- ✅ 100MB file size limit per upload
- ✅ Auto-expiry of URLs (15-minute window)
- ✅ Clinic-scoped folder permissions
- ✅ See `storage.rules` for full security model

---

## Development Setup

### Prerequisites
- Node.js 22+
- PostgreSQL 14+ (local or cloud)
- Redis (Upstash free tier recommended)
- Firebase CLI
- Git

### Quick Start

```bash
# 1. Clone repo
git clone https://github.com/yourusername/Nexus-Dental.git
cd Nexus-Dental

# 2. Install dependencies
npm install

# 3. Setup database
cp .env.local.example .env.local
# Edit .env.local with your DATABASE_URL and UPSTASH_REDIS_URL
npm run db:setup

# 4. Start dev server
npm run dev

# 5. Open browser
open http://localhost:3000
```

### Database Setup (Local)

```bash
# Install PostgreSQL
brew install postgresql

# Start Postgres
brew services start postgresql

# Create database
createdb nexusdental_dev

# Run migrations
npx prisma db push

# Seed test data
npm run seed
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Code Quality

```bash
# Lint
npm run lint

# Format
npm run format

# Type check
npm run type-check
```

### Build for Production

```bash
npm run build
npm start
```

---

## Roadmap

### Short Term (Next 30 days)
- [ ] Complete analytics dashboard (KPI reports, doctor performance)
- [ ] Build real-time patient messaging (Socket.io)
- [ ] Implement lab order tracking API
- [ ] Add pharmacy OTP dispensing module

### Medium Term (30-90 days)
- [ ] Patient document export (PDF + email)
- [ ] Advanced insurance analytics (claim success rates)
- [ ] Multi-clinic financial consolidation
- [ ] Clinic staff mobile app (iOS/Android)

### Long Term (90+ days)
- [ ] AI-powered appointment scheduling
- [ ] Predictive patient analytics (no-show prevention)
- [ ] Revenue forecasting (ML model)
- [ ] Integration with Ghana's digital payment systems
- [ ] Clinic network orchestration (multi-clinic dashboard)

---

## Support & Contact

**Email:** support@nexusdental.com  
**GitHub:** https://github.com/yourusername/Nexus-Dental  
**Documentation:** https://docs.nexusdental.com  
**Issues:** https://github.com/yourusername/Nexus-Dental/issues  

---

## License

MIT License — See LICENSE.md for details.

---

**Last Updated:** July 8, 2026  
**Version:** 1.0.0 (MVP Production Release)  
**Maintained By:** John Dakey (johnsedofiadakey@gmail.com)
