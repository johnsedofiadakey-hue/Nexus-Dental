-- CreateEnum
CREATE TYPE "InsuranceClaimStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PARTIAL');

-- AlterTable: Make AuditLog.userId nullable
ALTER TABLE "audit_logs" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable: Update SupportMessage to remove FK on senderId
ALTER TABLE "support_messages" DROP CONSTRAINT IF EXISTS "support_messages_senderId_fkey";

-- AlterTable: Change InsuranceClaim.status to enum
ALTER TABLE "insurance_claims" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "insurance_claims" ALTER COLUMN "status" TYPE "InsuranceClaimStatus" USING "status"::"InsuranceClaimStatus";
ALTER TABLE "insurance_claims" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

-- Update patient FK constraints to include CASCADE
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_patientId_fkey";
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_patientId_fkey";
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lab_orders" DROP CONSTRAINT IF EXISTS "lab_orders_patientId_fkey";
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "patient_consents" DROP CONSTRAINT IF EXISTS "patient_consents_patientId_fkey";
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "patient_files" DROP CONSTRAINT IF EXISTS "patient_files_patientId_fkey";
ALTER TABLE "patient_files" ADD CONSTRAINT "patient_files_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "prescriptions" DROP CONSTRAINT IF EXISTS "prescriptions_patientId_fkey";
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_patientId_fkey";
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_tickets" DROP CONSTRAINT IF EXISTS "support_tickets_patientId_fkey";
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tooth_records" DROP CONSTRAINT IF EXISTS "tooth_records_patientId_fkey";
ALTER TABLE "tooth_records" ADD CONSTRAINT "tooth_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "treatment_plans" DROP CONSTRAINT IF EXISTS "treatment_plans_patientId_fkey";
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "waitlist" DROP CONSTRAINT IF EXISTS "waitlist_patientId_fkey";
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add onDelete Restrict to audit_logs.userId
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_userId_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
