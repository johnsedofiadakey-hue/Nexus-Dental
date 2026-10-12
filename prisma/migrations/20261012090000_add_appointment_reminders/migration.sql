-- Live demo packet: durable, idempotent appointment SMS reminders. Additive only.

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "appointment_reminders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "offsetMinutes" INTEGER NOT NULL,
    "appointmentAt" TIMESTAMP(3) NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),
    "claimToken" TEXT,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_reminders_tenantId_idx" ON "appointment_reminders"("tenantId");

-- CreateIndex
CREATE INDEX "appointment_reminders_status_scheduledFor_idx" ON "appointment_reminders"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_reminders_appointmentId_offsetMinutes_appointme_key" ON "appointment_reminders"("appointmentId", "offsetMinutes", "appointmentAt");

-- AddForeignKey
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
