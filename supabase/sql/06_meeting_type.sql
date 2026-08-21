-- Adiciona suporte a tipo de reunião configurável por advogado
ALTER TABLE "LawyerSettings"
  ADD COLUMN IF NOT EXISTS "meetingType" TEXT NOT NULL DEFAULT 'google';
