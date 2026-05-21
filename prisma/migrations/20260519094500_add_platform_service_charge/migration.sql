ALTER TABLE "Booking"
ADD COLUMN "serviceChargeAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0;

CREATE TABLE "PlatformSetting" (
  "id" TEXT NOT NULL DEFAULT 'platform',
  "serviceChargeAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformSetting" (
  "id",
  "serviceChargeAmount",
  "updatedAt"
)
VALUES (
  'platform',
  0,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
