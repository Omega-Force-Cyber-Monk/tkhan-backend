-- Privacy alignment: additive fields and nullable business/booking address fields.
-- This migration is safe for existing data and does not require a reset.

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "sharePhoneWithBookingPartners" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "GroomerProfile"
ADD COLUMN IF NOT EXISTS "isRegisteredBusiness" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isGstRegistered" BOOLEAN NOT NULL DEFAULT false;

UPDATE "GroomerProfile"
SET "isRegisteredBusiness" = true
WHERE COALESCE(NULLIF(TRIM("businessName"), ''), NULL) IS NOT NULL;

UPDATE "GroomerProfile"
SET "isGstRegistered" = true
WHERE COALESCE(NULLIF(TRIM("gstHstRegistrationNumber"), ''), NULL) IS NOT NULL;

ALTER TABLE "GroomerProfile"
ALTER COLUMN "businessName" DROP NOT NULL,
ALTER COLUMN "businessAddress" DROP NOT NULL;

ALTER TABLE "Booking"
ALTER COLUMN "addressLine" DROP NOT NULL;
