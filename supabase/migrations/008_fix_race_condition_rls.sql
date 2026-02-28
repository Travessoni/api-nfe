-- ============================================================
-- FIX: Race condition numeração NF + RLS + UNIQUE focus_id
-- ============================================================

-- 1) Função atômica para numeração de NF (UPSERT com RETURNING)
CREATE OR REPLACE FUNCTION next_numero_nf(p_empresa_id BIGINT, p_serie TEXT)
RETURNS INTEGER AS $$
DECLARE v_next INTEGER;
BEGIN
  INSERT INTO fiscal_sequencia (empresa_id, serie, ultimo_numero)
  VALUES (p_empresa_id, p_serie, 1)
  ON CONFLICT (empresa_id, serie)
  DO UPDATE SET ultimo_numero = fiscal_sequencia.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_next;
  RETURN v_next;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION next_numero_nf IS 'Retorna próximo numero_nf de forma atômica (sem race condition)';

-- 2) UNIQUE constraint em focus_id (evita duplicatas e garante .maybeSingle())
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_fiscal_invoices_focus_id'
  ) THEN
    -- focus_id pode ser null para rascunhos, então usamos UNIQUE parcial
    CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_invoices_focus_id
      ON fiscal_invoices (focus_id) WHERE focus_id IS NOT NULL;
  END IF;
END $$;

-- 3) Habilitar RLS nas tabelas fiscais (acesso apenas via service_role)
ALTER TABLE fiscal_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_sequencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_eventos ENABLE ROW LEVEL SECURITY;

-- Políticas: permitir tudo para service_role (backend NestJS usa service_role key)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_fiscal_invoices') THEN
    CREATE POLICY service_role_fiscal_invoices ON fiscal_invoices
      FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_fiscal_sequencia') THEN
    CREATE POLICY service_role_fiscal_sequencia ON fiscal_sequencia
      FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_fiscal_eventos') THEN
    CREATE POLICY service_role_fiscal_eventos ON fiscal_eventos
      FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
  END IF;
END $$;
