-- ─── Planos: colunas no Lawyer ───────────────────────────────────────────────
ALTER TABLE "Lawyer"
  ADD COLUMN IF NOT EXISTS "plan"                 TEXT NOT NULL DEFAULT 'FREE',
  ADD COLUMN IF NOT EXISTS "planExpiresAt"        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "stripeCustomerId"     TEXT,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;

-- ─── SystemConfig (chave-valor para runtime config, ex: Stripe price ID) ──────
CREATE TABLE IF NOT EXISTS "SystemConfig" (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE "SystemConfig" ENABLE ROW LEVEL SECURITY;

-- ─── PlanSubscription (histórico de cobranças do plano Pro) ───────────────────
CREATE TABLE IF NOT EXISTS "PlanSubscription" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "lawyerId"        TEXT NOT NULL REFERENCES "Lawyer"("id") ON DELETE CASCADE,
  "stripeInvoiceId" TEXT UNIQUE,
  "amount"          DECIMAL(10,2) NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'paid',
  "periodStart"     TIMESTAMPTZ,
  "periodEnd"       TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE "PlanSubscription" ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS "PlanSubscription_lawyerId_idx" ON "PlanSubscription"("lawyerId");

CREATE POLICY "plan_subscription_select" ON "PlanSubscription"
  FOR SELECT USING (
    "lawyerId" = (SELECT id FROM "Lawyer" WHERE auth_id = auth.uid())
  );

-- ─── RPC: get_plan_info() — retorna plano + contagem mensal do advogado logado ─
CREATE OR REPLACE FUNCTION get_plan_info()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lawyer_id        TEXT;
  v_plan             TEXT;
  v_plan_expires_at  TIMESTAMPTZ;
  v_monthly_count    INTEGER;
  v_period_start     TIMESTAMPTZ;
  v_period_end       TIMESTAMPTZ;
BEGIN
  SELECT id, plan, "planExpiresAt"
    INTO v_lawyer_id, v_plan, v_plan_expires_at
    FROM "Lawyer"
   WHERE auth_id = auth.uid();

  IF v_lawyer_id IS NULL THEN
    RETURN json_build_object('plan','FREE','monthlyCount',0,'monthlyLimit',20);
  END IF;

  -- Expiração automática de planos Pro vencidos
  IF v_plan = 'PRO' AND v_plan_expires_at IS NOT NULL AND v_plan_expires_at < NOW() THEN
    UPDATE "Lawyer"
       SET plan = 'FREE', "stripeSubscriptionId" = NULL
     WHERE id = v_lawyer_id;
    v_plan := 'FREE';
    v_plan_expires_at := NULL;
  END IF;

  -- Período do mês calendário no fuso America/Sao_Paulo
  v_period_start := date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
                    AT TIME ZONE 'America/Sao_Paulo';
  v_period_end   := v_period_start + INTERVAL '1 month';

  SELECT COUNT(*) INTO v_monthly_count
    FROM "Appointment"
   WHERE "lawyerId" = v_lawyer_id
     AND date >= v_period_start
     AND date <  v_period_end;

  RETURN json_build_object(
    'plan',         v_plan,
    'planExpiresAt',v_plan_expires_at,
    'monthlyCount', v_monthly_count,
    'monthlyLimit', CASE WHEN v_plan = 'PRO' THEN NULL ELSE 20 END,
    'periodStart',  v_period_start,
    'periodEnd',    v_period_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_plan_info() TO authenticated;

-- ─── RPC: get_appointment_month_count_by_slug — acesso público (anon) ─────────
DROP FUNCTION IF EXISTS get_appointment_month_count_by_slug(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION get_appointment_month_count_by_slug(p_slug TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lawyer_id    TEXT;
  v_plan         TEXT;
  v_count        INTEGER;
  v_period_start TIMESTAMPTZ;
  v_period_end   TIMESTAMPTZ;
BEGIN
  SELECT l.id, l.plan
    INTO v_lawyer_id, v_plan
    FROM "Lawyer" l
    JOIN "LawyerSettings" s ON s."lawyerId" = l.id
   WHERE s."schedulerSlug" = p_slug;

  IF v_lawyer_id IS NULL THEN
    RETURN json_build_object('blocked', false);
  END IF;

  IF v_plan = 'PRO' THEN
    RETURN json_build_object('blocked', false);
  END IF;

  v_period_start := date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
                    AT TIME ZONE 'America/Sao_Paulo';
  v_period_end   := v_period_start + INTERVAL '1 month';

  SELECT COUNT(*) INTO v_count
    FROM "Appointment"
   WHERE "lawyerId" = v_lawyer_id
     AND date >= v_period_start
     AND date <  v_period_end;

  RETURN json_build_object(
    'blocked', v_count >= 20,
    'count',   v_count,
    'limit',   20
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_appointment_month_count_by_slug(TEXT) TO anon, authenticated;
