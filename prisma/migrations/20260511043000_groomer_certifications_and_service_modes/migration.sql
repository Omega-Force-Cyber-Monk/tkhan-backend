-- Alter groomer profile certifications from text[] to JSON objects and add service modes.
ALTER TABLE "GroomerProfile"
  ALTER COLUMN "certifications" DROP DEFAULT,
  ALTER COLUMN "certifications" TYPE JSONB USING to_jsonb("certifications"),
  ALTER COLUMN "certifications" SET DEFAULT '[]'::jsonb;

ALTER TABLE "GroomerProfile"
  ADD COLUMN "serviceModes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
