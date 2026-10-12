-- Server-controlled, revocable sessions (Packet C2). Purely additive: one enum, one table.

-- CreateEnum
CREATE TYPE "AuthSubjectType" AS ENUM ('STAFF', 'PATIENT');

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "sidHash" TEXT NOT NULL,
    "subjectType" "AuthSubjectType" NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "patientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idleExpiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_sidHash_key" ON "auth_sessions"("sidHash");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_revokedAt_idx" ON "auth_sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "auth_sessions_patientId_revokedAt_idx" ON "auth_sessions"("patientId", "revokedAt");

-- CreateIndex
CREATE INDEX "auth_sessions_absoluteExpiresAt_idx" ON "auth_sessions"("absoluteExpiresAt");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Exactly one subject per session, matching its type. Not expressible in the
-- Prisma schema, so it lives only here; the database refuses a malformed row.
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_subject_check" CHECK (
    ("subjectType" = 'STAFF'   AND "userId" IS NOT NULL AND "patientId" IS NULL)
 OR ("subjectType" = 'PATIENT' AND "patientId" IS NOT NULL AND "userId" IS NULL)
);
