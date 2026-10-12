ALTER TABLE "Payment"
ALTER COLUMN "currency" SET DEFAULT 'cad';

ALTER TABLE "Payout"
ALTER COLUMN "currency" SET DEFAULT 'cad';

ALTER TABLE "WithdrawalRequest"
ALTER COLUMN "currency" SET DEFAULT 'cad';
