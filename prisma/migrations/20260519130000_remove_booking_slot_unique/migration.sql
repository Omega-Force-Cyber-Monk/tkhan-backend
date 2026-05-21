DROP INDEX IF EXISTS "Booking_availabilitySlotId_key";

CREATE INDEX IF NOT EXISTS "Booking_availabilitySlotId_idx"
ON "Booking"("availabilitySlotId");
