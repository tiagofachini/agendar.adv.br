-- ─── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING_PAYMENT','CONFIRMED','CANCELLED','COMPLETED','EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING','PAID','OVERDUE','CANCELLED','REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Trigger: atualiza updatedAt automaticamente ──────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW."updatedAt" = NOW(); RETURN NEW; END;
$$;

-- ─── Lawyer ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Lawyer" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "auth_id"   UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  "name"      TEXT NOT NULL,
  "email"     TEXT NOT NULL UNIQUE,
  "whatsapp"  TEXT,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS "Lawyer_updatedAt" ON "Lawyer";
CREATE TRIGGER "Lawyer_updatedAt"
  BEFORE UPDATE ON "Lawyer" FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── LawyerSettings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LawyerSettings" (
  "id"                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "lawyerId"               TEXT NOT NULL UNIQUE REFERENCES "Lawyer"("id") ON DELETE CASCADE,
  "cep"                    TEXT,
  "street"                 TEXT,
  "number"                 TEXT,
  "complement"             TEXT,
  "neighborhood"           TEXT,
  "city"                   TEXT,
  "state"                  TEXT,
  "logoUrl"                TEXT,
  "specialties"            TEXT[] DEFAULT '{}',
  "schedulerSlug"          TEXT UNIQUE,
  "slotDuration"           INTEGER NOT NULL DEFAULT 60,
  "highlightMessage"       TEXT,
  "workDays"               INTEGER[] DEFAULT '{1,2,3,4,5}',
  "workStartTime"          TEXT NOT NULL DEFAULT '09:00',
  "workEndTime"            TEXT NOT NULL DEFAULT '18:00',
  "hourlyRate"             DECIMAL(10,2),
  "asaasApiKey"            TEXT,
  "asaasWalletId"          TEXT,
  "newBookingByEmail"      BOOLEAN NOT NULL DEFAULT true,
  "newBookingByWhatsapp"   BOOLEAN NOT NULL DEFAULT false,
  "cancellationByEmail"    BOOLEAN NOT NULL DEFAULT true,
  "cancellationByWhatsapp" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS "LawyerSettings_updatedAt" ON "LawyerSettings";
CREATE TRIGGER "LawyerSettings_updatedAt"
  BEFORE UPDATE ON "LawyerSettings" FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Client ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Client" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "lawyerId"  TEXT NOT NULL REFERENCES "Lawyer"("id") ON DELETE CASCADE,
  "name"      TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "whatsapp"  TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("lawyerId", "email")
);

CREATE INDEX IF NOT EXISTS "Client_lawyerId_idx" ON "Client"("lawyerId");

DROP TRIGGER IF EXISTS "Client_updatedAt" ON "Client";
CREATE TRIGGER "Client_updatedAt"
  BEFORE UPDATE ON "Client" FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Appointment ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Appointment" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "lawyerId"       TEXT NOT NULL REFERENCES "Lawyer"("id") ON DELETE CASCADE,
  "clientId"       TEXT REFERENCES "Client"("id") ON DELETE SET NULL,
  "clientName"     TEXT NOT NULL,
  "clientEmail"    TEXT NOT NULL,
  "clientWhatsapp" TEXT,
  "specialty"      TEXT NOT NULL,
  "description"    TEXT,
  "audioUrl"       TEXT,
  "date"           TIMESTAMPTZ NOT NULL,
  "duration"       INTEGER NOT NULL DEFAULT 60,
  "status"         "AppointmentStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "Appointment_lawyerId_date_idx"   ON "Appointment"("lawyerId", "date");
CREATE INDEX IF NOT EXISTS "Appointment_lawyerId_status_idx" ON "Appointment"("lawyerId", "status");

DROP TRIGGER IF EXISTS "Appointment_updatedAt" ON "Appointment";
CREATE TRIGGER "Appointment_updatedAt"
  BEFORE UPDATE ON "Appointment" FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Payment ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Payment" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "lawyerId"      TEXT NOT NULL REFERENCES "Lawyer"("id") ON DELETE CASCADE,
  "clientId"      TEXT REFERENCES "Client"("id") ON DELETE SET NULL,
  "appointmentId" TEXT UNIQUE REFERENCES "Appointment"("id") ON DELETE SET NULL,
  "amount"        DECIMAL(10,2) NOT NULL,
  "status"        "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "asaasId"       TEXT UNIQUE,
  "asaasUrl"      TEXT,
  "dueDate"       TIMESTAMPTZ,
  "paidAt"        TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "Payment_lawyerId_idx"        ON "Payment"("lawyerId");
CREATE INDEX IF NOT EXISTS "Payment_lawyerId_status_idx" ON "Payment"("lawyerId", "status");

DROP TRIGGER IF EXISTS "Payment_updatedAt" ON "Payment";
CREATE TRIGGER "Payment_updatedAt"
  BEFORE UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
