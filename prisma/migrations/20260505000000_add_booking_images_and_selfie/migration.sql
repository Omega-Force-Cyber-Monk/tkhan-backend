-- AlterTable: Add before/after images to Booking
ALTER TABLE "Booking" ADD COLUMN "beforeImage" TEXT,
ADD COLUMN "afterImage" TEXT;

-- AlterTable: Add selfieWithId to GroomerProfile
ALTER TABLE "GroomerProfile" ADD COLUMN "selfieWithId" TEXT;

-- AlterTable: Add email verification token fields to User
ALTER TABLE "User" ADD COLUMN "emailVerificationToken" TEXT,
ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3);
