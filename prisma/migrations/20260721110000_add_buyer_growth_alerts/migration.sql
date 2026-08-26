ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GROWTH_ALERT';

CREATE TYPE "BuyerGrowthAlertKind" AS ENUM (
  'INACTIVE_USER',
  'REPEAT_CUSTOMER',
  'FAVORITE_GROOMER_OPENED_AVAILABILITY',
  'LAST_MINUTE_AVAILABILITY'
);

CREATE TABLE "BuyerGrowthAlert" (
  "id" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "kind" "BuyerGrowthAlertKind" NOT NULL,
  "contextId" TEXT,
  "notificationId" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BuyerGrowthAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BuyerGrowthAlert_buyerId_kind_contextId_sentAt_idx"
  ON "BuyerGrowthAlert"("buyerId", "kind", "contextId", "sentAt");

CREATE INDEX "BuyerGrowthAlert_sentAt_idx" ON "BuyerGrowthAlert"("sentAt");

ALTER TABLE "BuyerGrowthAlert"
  ADD CONSTRAINT "BuyerGrowthAlert_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
