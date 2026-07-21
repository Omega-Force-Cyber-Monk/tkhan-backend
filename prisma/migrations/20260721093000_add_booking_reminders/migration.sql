ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_REMINDER';

CREATE TYPE "BookingReminderKind" AS ENUM ('TWENTY_FOUR_HOURS', 'ONE_HOUR');

CREATE TYPE "BookingReminderRecipientRole" AS ENUM ('BUYER', 'GROOMER');

CREATE TABLE "BookingReminder" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "kind" "BookingReminderKind" NOT NULL,
  "recipientRole" "BookingReminderRecipientRole" NOT NULL,
  "recipientId" TEXT NOT NULL,
  "notificationId" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BookingReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingReminder_bookingId_kind_recipientRole_key"
  ON "BookingReminder"("bookingId", "kind", "recipientRole");

CREATE INDEX "BookingReminder_recipientId_idx" ON "BookingReminder"("recipientId");

CREATE INDEX "BookingReminder_sentAt_idx" ON "BookingReminder"("sentAt");

ALTER TABLE "BookingReminder"
  ADD CONSTRAINT "BookingReminder_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
