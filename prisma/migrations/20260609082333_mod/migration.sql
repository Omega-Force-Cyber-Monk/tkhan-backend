/*
  Warnings:

  - You are about to drop the column `locationText` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_state_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "locationText",
DROP COLUMN "state",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "streetAddress" TEXT,
ADD COLUMN     "unitSuite" TEXT;

-- CreateIndex
CREATE INDEX "User_province_idx" ON "User"("province");

-- CreateIndex
CREATE INDEX "User_city_idx" ON "User"("city");
