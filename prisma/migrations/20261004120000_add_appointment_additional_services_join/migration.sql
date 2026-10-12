-- Appointment <-> Service many-to-many join table ("additionalServices").
--
-- This table exists in schema.prisma (Appointment.additionalServices /
-- Service.additionalAppointments) but was never part of a migration: it was
-- created in the original database by `prisma db push`. A database built ONLY
-- from migrations (every new clinic deployment) was therefore missing it, and
-- any query that includes `additionalServices` failed with "relation does not
-- exist".
--
-- Written to be idempotent so the SAME migration is safe on:
--   * a fresh database built from migrations (creates the table), and
--   * an existing database that already has the table from `db push`
--     (every statement is a no-op).

-- CreateTable
CREATE TABLE IF NOT EXISTS "_AppointmentAdditionalServices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AppointmentAdditionalServices_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_AppointmentAdditionalServices_B_index" ON "_AppointmentAdditionalServices"("B");

-- AddForeignKey (ADD CONSTRAINT has no IF NOT EXISTS, so guard each one)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = '_AppointmentAdditionalServices_A_fkey'
    ) THEN
        ALTER TABLE "_AppointmentAdditionalServices"
            ADD CONSTRAINT "_AppointmentAdditionalServices_A_fkey"
            FOREIGN KEY ("A") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = '_AppointmentAdditionalServices_B_fkey'
    ) THEN
        ALTER TABLE "_AppointmentAdditionalServices"
            ADD CONSTRAINT "_AppointmentAdditionalServices_B_fkey"
            FOREIGN KEY ("B") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
