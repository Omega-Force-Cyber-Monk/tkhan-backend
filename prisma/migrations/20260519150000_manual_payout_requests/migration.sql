-- CreateEnum (safe)
DO $$ BEGIN
  CREATE TYPE "WithdrawalRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DropIndex (safe)
DROP INDEX IF EXISTS "Payout_bookingId_idx";
DROP INDEX IF EXISTS "Payout_groomerId_status_idx";

-- AlterTable: drop columns only if they exist
ALTER TABLE "Payout"
  DROP COLUMN IF EXISTS "failureReason",
  DROP COLUMN IF EXISTS "releasedAt",
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "stripeTransferId";

-- CreateTable (safe)
CREATE TABLE IF NOT EXISTS "GroomerBankAccount" (
    "id" TEXT NOT NULL,
    "groomerId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "branchName" TEXT,
    "routingNumber" TEXT,
    "mobileBankingType" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroomerBankAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "groomerId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "amountRequested" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "WithdrawalRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "adminNote" TEXT,
    "transferReference" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WithdrawalRequestItem" (
    "id" TEXT NOT NULL,
    "withdrawalRequestId" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (safe)
CREATE UNIQUE INDEX IF NOT EXISTS "Payout_bookingId_key" ON "Payout"("bookingId");
CREATE INDEX IF NOT EXISTS "Payout_groomerId_idx" ON "Payout"("groomerId");
CREATE INDEX IF NOT EXISTS "GroomerBankAccount_groomerId_isDefault_idx" ON "GroomerBankAccount"("groomerId", "isDefault");
CREATE INDEX IF NOT EXISTS "WithdrawalRequest_groomerId_status_idx" ON "WithdrawalRequest"("groomerId", "status");
CREATE INDEX IF NOT EXISTS "WithdrawalRequest_bankAccountId_idx" ON "WithdrawalRequest"("bankAccountId");
CREATE UNIQUE INDEX IF NOT EXISTS "WithdrawalRequestItem_withdrawalRequestId_payoutId_key" ON "WithdrawalRequestItem"("withdrawalRequestId", "payoutId");
CREATE INDEX IF NOT EXISTS "WithdrawalRequestItem_payoutId_idx" ON "WithdrawalRequestItem"("payoutId");

-- AddForeignKey (safe)
DO $$ BEGIN
  ALTER TABLE "GroomerBankAccount" ADD CONSTRAINT "GroomerBankAccount_groomerId_fkey" FOREIGN KEY ("groomerId") REFERENCES "GroomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_groomerId_fkey" FOREIGN KEY ("groomerId") REFERENCES "GroomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "GroomerBankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WithdrawalRequestItem" ADD CONSTRAINT "WithdrawalRequestItem_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "WithdrawalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WithdrawalRequestItem" ADD CONSTRAINT "WithdrawalRequestItem_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DropTable (safe)
DROP TABLE IF EXISTS "GroomerPaymentMethod";
