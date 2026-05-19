ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

ALTER TABLE "Payment"
ALTER COLUMN "status" SET DEFAULT 'PAYMENT_PENDING';

ALTER TABLE "Booking"
ALTER COLUMN "status" SET DEFAULT 'PENDING';

UPDATE "Booking"
SET "status" = 'PENDING'
WHERE "status" = 'PAYMENT_PENDING';

UPDATE "Payment"
SET "status" = 'PAYMENT_PENDING'
WHERE "status" = 'PENDING';

UPDATE "Payment" AS p
SET "status" = 'COMPLETED'
FROM "Booking" AS b
WHERE p."bookingId" = b."id"
  AND b."status" = 'COMPLETED'
  AND p."status" = 'SUCCEEDED';
