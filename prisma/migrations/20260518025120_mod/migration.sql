/*
  Warnings:

  - Made the column `certifications` on table `GroomerProfile` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "GroomerProfile" ALTER COLUMN "certifications" SET NOT NULL;
