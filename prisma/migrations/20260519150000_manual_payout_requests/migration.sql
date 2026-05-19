-- CreateEnum
CREATE TYPE "WithdrawalRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- DropIndex
DROP INDEX IF EXISTS "Payout_bookingId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Payout_groomerId_status_idx";

-- AlterTable
ALTER TABLE "Payout"
DROP COLUMN "failureReason",
DROP COLUMN "releasedAt",
DROP COLUMN "status",
DROP COLUMN "stripeTransferId";

-- CreateTable
CREATE TABLE "GroomerBankAccount" (
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

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
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

-- CreateTable
CREATE TABLE "WithdrawalRequestItem" (
    "id" TEXT NOT NULL,
    "withdrawalRequestId" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payout_bookingId_key" ON "Payout"("bookingId");

-- CreateIndex
CREATE INDEX "Payout_groomerId_idx" ON "Payout"("groomerId");

-- CreateIndex
CREATE INDEX "GroomerBankAccount_groomerId_isDefault_idx" ON "GroomerBankAccount"("groomerId", "isDefault");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_groomerId_status_idx" ON "WithdrawalRequest"("groomerId", "status");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_bankAccountId_idx" ON "WithdrawalRequest"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalRequestItem_withdrawalRequestId_payoutId_key" ON "WithdrawalRequestItem"("withdrawalRequestId", "payoutId");

-- CreateIndex
CREATE INDEX "WithdrawalRequestItem_payoutId_idx" ON "WithdrawalRequestItem"("payoutId");

-- AddForeignKey
ALTER TABLE "GroomerBankAccount" ADD CONSTRAINT "GroomerBankAccount_groomerId_fkey" FOREIGN KEY ("groomerId") REFERENCES "GroomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_groomerId_fkey" FOREIGN KEY ("groomerId") REFERENCES "GroomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "GroomerBankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequestItem" ADD CONSTRAINT "WithdrawalRequestItem_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "WithdrawalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequestItem" ADD CONSTRAINT "WithdrawalRequestItem_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropTable
DROP TABLE "GroomerPaymentMethod";
