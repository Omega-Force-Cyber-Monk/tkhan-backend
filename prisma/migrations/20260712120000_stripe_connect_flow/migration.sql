DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM (
    'PENDING',
    'TRANSFERRED',
    'PAID_OUT',
    'FAILED',
    'REVERSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "GroomerProfile"
  ADD COLUMN IF NOT EXISTS "stripeConnectedAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeOnboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stripeTransfersEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stripeOnboardingStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "stripeOnboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "stripeConnectCountry" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeConnectEmail" TEXT;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "stripeChargeId" TEXT;

ALTER TABLE "Payout"
  ADD COLUMN IF NOT EXISTS "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "stripeTransferId" TEXT,
  ADD COLUMN IF NOT EXISTS "transferredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "payoutPaidOutAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failureReason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "GroomerProfile_stripeConnectedAccountId_key"
  ON "GroomerProfile"("stripeConnectedAccountId");

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_stripeChargeId_key"
  ON "Payment"("stripeChargeId");

CREATE UNIQUE INDEX IF NOT EXISTS "Payout_stripeTransferId_key"
  ON "Payout"("stripeTransferId");
