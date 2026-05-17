-- Detalhes do atendimento (notas do advogado sobre a consulta realizada)
ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "attendanceNotes" TEXT;

-- Mensagens WhatsApp via Twilio
CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "lawyerId"  TEXT NOT NULL REFERENCES "Lawyer"("id") ON DELETE CASCADE,
  "clientId"  TEXT NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "direction" TEXT NOT NULL CHECK ("direction" IN ('OUTBOUND', 'INBOUND')),
  "body"      TEXT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'sent',
  "twilioSid" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "WhatsAppMessage_clientId_idx" ON "WhatsAppMessage"("clientId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_lawyerId_idx" ON "WhatsAppMessage"("lawyerId");

ALTER TABLE "WhatsAppMessage" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "WhatsAppMessage_lawyer_rw" ON "WhatsAppMessage"
    FOR ALL TO authenticated
    USING ("lawyerId" IN (SELECT id FROM "Lawyer" WHERE auth_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
