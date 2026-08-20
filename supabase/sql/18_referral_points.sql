-- Adiciona sistema de pontos de indicação e tabela de pedidos de prêmio.
-- Indicação válida = cadastro + email confirmado + login efetuado (via auth.users).

-- Tabela de pedidos de prêmio
CREATE TABLE IF NOT EXISTS "PrizeRequest" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "lawyerId" TEXT NOT NULL REFERENCES "Lawyer"(id),
  "lawyerName" TEXT,
  "lawyerEmail" TEXT,
  points BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "processedAt" TIMESTAMPTZ
);

ALTER TABLE "PrizeRequest" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prize_own_select" ON "PrizeRequest"
  FOR SELECT TO authenticated
  USING ((SELECT id FROM "Lawyer" WHERE auth_id = auth.uid()) = "lawyerId");

-- Helper: conta indicações válidas para um dado código
CREATE OR REPLACE FUNCTION count_valid_referrals(referral_code TEXT)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM "Lawyer" l
    JOIN auth.users u ON u.id = l.auth_id
    WHERE l."referredByCode" = referral_code
      AND u.email_confirmed_at IS NOT NULL
      AND u.last_sign_in_at IS NOT NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION count_valid_referrals(TEXT) TO authenticated, service_role;

-- Atualiza get_referral_stats: retorna points (tipo mudou, então DROP primeiro)
DROP FUNCTION IF EXISTS get_referral_stats() CASCADE;

CREATE OR REPLACE FUNCTION get_referral_stats()
RETURNS TABLE(points BIGINT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code TEXT;
BEGIN
  SELECT "referralCode" INTO v_code FROM "Lawyer" WHERE auth_id = auth.uid();
  IF v_code IS NULL THEN
    RETURN QUERY SELECT 0::BIGINT;
    RETURN;
  END IF;

  RETURN QUERY SELECT count_valid_referrals(v_code);
END;
$$;

GRANT EXECUTE ON FUNCTION get_referral_stats() TO authenticated;

-- Admin: lista todos os pedidos de prêmio
CREATE OR REPLACE FUNCTION list_prize_requests()
RETURNS TABLE(
  id UUID,
  "lawyerName" TEXT,
  "lawyerEmail" TEXT,
  points BIGINT,
  status TEXT,
  "requestedAt" TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'emaildogago@gmail.com' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT r.id, r."lawyerName", r."lawyerEmail", r.points, r.status, r."requestedAt"
  FROM "PrizeRequest" r
  ORDER BY r."requestedAt" DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_prize_requests() TO authenticated;

-- Admin: atualiza status de um pedido de prêmio
CREATE OR REPLACE FUNCTION update_prize_request(request_id UUID, new_status TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'emaildogago@gmail.com' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE "PrizeRequest"
  SET status = new_status, "processedAt" = now()
  WHERE id = request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_prize_request(UUID, TEXT) TO authenticated;
