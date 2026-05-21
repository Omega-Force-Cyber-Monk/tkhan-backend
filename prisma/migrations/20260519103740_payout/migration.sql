-- AlterTable: drop the status column that depends on PayoutStatus (if it still exists)
ALTER TABLE "Payout" DROP COLUMN IF EXISTS "status";

-- DropEnum
DROP TYPE IF EXISTS "PayoutStatus";
