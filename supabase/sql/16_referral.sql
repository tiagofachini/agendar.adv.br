-- Adiciona colunas de indicação à tabela Lawyer
ALTER TABLE "Lawyer" ADD COLUMN IF NOT EXISTS "referralCode" TEXT UNIQUE;
ALTER TABLE "Lawyer" ADD COLUMN IF NOT EXISTS "referredByCode" TEXT;
ALTER TABLE "Lawyer" ADD COLUMN IF NOT EXISTS "referralRewardedAt" TIMESTAMPTZ;

-- RPC: retorna (criando se necessário) o código de indicação do advogado autenticado
CREATE OR REPLACE FUNCTION get_or_create_referral_code()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id   UUID;
  v_code TEXT;
BEGIN
  SELECT id INTO v_id FROM "Lawyer" WHERE auth_id = auth.uid();
  IF v_id IS NULL THEN RETURN NULL; END IF;

  SELECT "referralCode" INTO v_code FROM "Lawyer" WHERE id = v_id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;

  LOOP
    v_code := upper(substring(md5(gen_random_uuid()::text), 1, 8));
    BEGIN
      UPDATE "Lawyer" SET "referralCode" = v_code WHERE id = v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- colisão rara, tenta novo código
    END;
  END LOOP;

  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_referral_code() TO authenticated;

-- RPC: estatísticas de indicações do advogado autenticado
CREATE OR REPLACE FUNCTION get_referral_stats()
RETURNS TABLE(total BIGINT, reward_months BIGINT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code TEXT;
BEGIN
  SELECT "referralCode" INTO v_code FROM "Lawyer" WHERE auth_id = auth.uid();
  IF v_code IS NULL THEN
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT COUNT(*)::BIGINT, COUNT(*)::BIGINT
  FROM "Lawyer"
  WHERE "referredByCode" = v_code
    AND "referralRewardedAt" IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_referral_stats() TO authenticated;
