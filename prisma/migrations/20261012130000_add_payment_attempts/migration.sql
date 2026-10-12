-- Durable Paystack attempts. Additive only: existing invoices and references remain valid.

CREATE TYPE "PaymentAttemptStatus" AS ENUM (
    'INITIALIZING',
    'PENDING',
    'SUCCEEDED',
    'FAILED',
    'PARTIALLY_REFUNDED',
    'REFUNDED'
);

CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
    "reference" TEXT NOT NULL,
    "expectedAmountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'INITIALIZING',
    "authorizationUrl" TEXT,
    "accessCode" TEXT,
    "providerTransactionId" TEXT,
    "channel" TEXT,
    "failureReason" TEXT,
    "refundedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "initializedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_attempts_reference_key" ON "payment_attempts"("reference");
CREATE UNIQUE INDEX "payment_attempts_providerTransactionId_key" ON "payment_attempts"("providerTransactionId");
CREATE INDEX "payment_attempts_tenantId_createdAt_idx" ON "payment_attempts"("tenantId", "createdAt");
CREATE INDEX "payment_attempts_invoiceId_status_idx" ON "payment_attempts"("invoiceId", "status");

ALTER TABLE "payment_attempts"
    ADD CONSTRAINT "payment_attempts_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_attempts"
    ADD CONSTRAINT "payment_attempts_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
