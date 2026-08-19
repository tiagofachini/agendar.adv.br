-- Garante colunas Asaas em LawyerSettings
ALTER TABLE "LawyerSettings" ADD COLUMN IF NOT EXISTS "asaasApiKey" TEXT;
ALTER TABLE "LawyerSettings" ADD COLUMN IF NOT EXISTS "pixKey" TEXT;

-- Garante coluna asaasId em Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "asaasId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMPTZ;

-- Garante status PENDING_PAYMENT no enum AppointmentStatus (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'PENDING_PAYMENT'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AppointmentStatus')
  ) THEN
    ALTER TYPE "AppointmentStatus" ADD VALUE 'PENDING_PAYMENT';
  END IF;
END$$;
