-- Corrige erro "operator does not exist: text = uuid" nas funções de indicação.
-- Causa: Lawyer.id é TEXT (cuid), mas v_id era declarado como UUID.
-- A comparação "WHERE id = v_id" falhava porque TEXT = UUID não tem operador implícito.

DROP FUNCTION IF EXISTS get_or_create_referral_code() CASCADE;
DROP FUNCTION IF EXISTS get_referral_stats() CASCADE;

CREATE OR REPLACE FUNCTION get_or_create_referral_code()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id   TEXT;
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
