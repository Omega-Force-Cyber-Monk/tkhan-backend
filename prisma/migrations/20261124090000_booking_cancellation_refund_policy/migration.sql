-- Cancellation & refund policy, terms acceptance and groomer no-show tracking.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_CANCELLED';

CREATE TYPE "BookingCancelledBy" AS ENUM ('BUYER', 'GROOMER', 'ADMIN', 'SYSTEM');
CREATE TYPE "GroomerNoShowAction" AS ENUM ('NONE', 'WARNING', 'SUSPENSION', 'BLOCK');

ALTER TABLE "Booking"
  ADD COLUMN "cancelledBy" "BookingCancelledBy",
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "isLateCancellation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "refundPercent" INTEGER,
  ADD COLUMN "refundAmount" DECIMAL(10,2),
  ADD COLUMN "lateFeeAmount" DECIMAL(10,2),
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "termsVersion" TEXT;

ALTER TABLE "Payment"
  ADD COLUMN "refundedAmount" DECIMAL(10,2);

ALTER TABLE "GroomerProfile"
  ADD COLUMN "noShowCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastNoShowAt" TIMESTAMP(3),
  ADD COLUMN "suspendedUntil" TIMESTAMP(3);

CREATE TABLE "GroomerNoShow" (
  "id" TEXT NOT NULL,
  "groomerProfileId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "hoursBeforeStart" DECIMAL(10,2) NOT NULL,
  "reason" TEXT,
  "actionTaken" "GroomerNoShowAction" NOT NULL DEFAULT 'NONE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroomerNoShow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GroomerNoShow_bookingId_key" ON "GroomerNoShow"("bookingId");
CREATE INDEX "GroomerNoShow_groomerProfileId_createdAt_idx" ON "GroomerNoShow"("groomerProfileId", "createdAt");

ALTER TABLE "GroomerNoShow"
  ADD CONSTRAINT "GroomerNoShow_groomerProfileId_fkey" FOREIGN KEY ("groomerProfileId") REFERENCES "GroomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroomerNoShow"
  ADD CONSTRAINT "GroomerNoShow_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
