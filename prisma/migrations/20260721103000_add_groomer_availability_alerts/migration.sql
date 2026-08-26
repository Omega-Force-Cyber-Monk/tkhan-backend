ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AVAILABILITY_ALERT';

CREATE TYPE "GroomerAvailabilityAlertKind" AS ENUM (
  'NO_AVAILABILITY',
  'RUNNING_LOW',
  'CALENDAR_EXPIRING'
);

CREATE TABLE "GroomerAvailabilityAlert" (
  "id" TEXT NOT NULL,
  "groomerId" TEXT NOT NULL,
  "kind" "GroomerAvailabilityAlertKind" NOT NULL,
  "notificationId" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GroomerAvailabilityAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GroomerAvailabilityAlert_groomerId_kind_sentAt_idx"
  ON "GroomerAvailabilityAlert"("groomerId", "kind", "sentAt");

CREATE INDEX "GroomerAvailabilityAlert_sentAt_idx"
  ON "GroomerAvailabilityAlert"("sentAt");

ALTER TABLE "GroomerAvailabilityAlert"
  ADD CONSTRAINT "GroomerAvailabilityAlert_groomerId_fkey"
  FOREIGN KEY ("groomerId") REFERENCES "GroomerProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
