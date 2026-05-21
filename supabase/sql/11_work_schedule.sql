ALTER TABLE "LawyerSettings"
  ADD COLUMN IF NOT EXISTS "workSchedule"   JSONB,
  ADD COLUMN IF NOT EXISTS "specialtyRates" JSONB DEFAULT '[]'::jsonb;
