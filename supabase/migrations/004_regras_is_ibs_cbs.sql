-- ============================================================
-- Regras IS, IBS e CBS (Reforma Tributária 2026)
-- Mesma lógica das regras ICMS, PIS, COFINS, IPI
-- Vinculadas por naturezaRef à natureza de operação
-- ============================================================

-- 1) Regras IS - Imposto Seletivo (produtos específicos: bebidas, cigarros, etc.)
CREATE TABLE IF NOT EXISTS regrasIS (
  id BIGSERIAL PRIMARY KEY,
  "naturezaRef" BIGINT NOT NULL,
  destinos TEXT,
  "situacaoTributaria" TEXT,
  "classificacaoTributaria" TEXT,
  aliquota NUMERIC(5, 4),
  base NUMERIC(5, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regras_is_natureza_ref ON regrasIS("naturezaRef");
COMMENT ON TABLE regrasIS IS 'Regras Imposto Seletivo por natureza de operação - Reforma Tributária 2026';

-- 2) Regras IBS - Imposto sobre Bens e Serviços
CREATE TABLE IF NOT EXISTS regrasIBS (
  id BIGSERIAL PRIMARY KEY,
  "naturezaRef" BIGINT NOT NULL,
  destinos TEXT,
  "situacaoTributaria" TEXT,
  "classificacaoTributaria" TEXT,
  aliquota NUMERIC(5, 4),
  base NUMERIC(5, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regras_ibs_natureza_ref ON regrasIBS("naturezaRef");
COMMENT ON TABLE regrasIBS IS 'Regras IBS - Imposto sobre Bens e Serviços por natureza - Reforma Tributária 2026';

-- 3) Regras CBS - Contribuição sobre Bens e Serviços
CREATE TABLE IF NOT EXISTS regrasCBS (
  id BIGSERIAL PRIMARY KEY,
  "naturezaRef" BIGINT NOT NULL,
  destinos TEXT,
  "situacaoTributaria" TEXT,
  "classificacaoTributaria" TEXT,
  aliquota NUMERIC(5, 4),
  base NUMERIC(5, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regras_cbs_natureza_ref ON regrasCBS("naturezaRef");
COMMENT ON TABLE regrasCBS IS 'Regras CBS - Contribuição sobre Bens e Serviços por natureza - Reforma Tributária 2026';

-- Triggers updated_at
CREATE OR REPLACE FUNCTION regras_tributarias_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_regras_is_updated_at ON regrasIS;
CREATE TRIGGER trigger_regras_is_updated_at
  BEFORE UPDATE ON regrasIS
  FOR EACH ROW EXECUTE PROCEDURE regras_tributarias_updated_at();

DROP TRIGGER IF EXISTS trigger_regras_ibs_updated_at ON regrasIBS;
CREATE TRIGGER trigger_regras_ibs_updated_at
  BEFORE UPDATE ON regrasIBS
  FOR EACH ROW EXECUTE PROCEDURE regras_tributarias_updated_at();

DROP TRIGGER IF EXISTS trigger_regras_cbs_updated_at ON regrasCBS;
CREATE TRIGGER trigger_regras_cbs_updated_at
  BEFORE UPDATE ON regrasCBS
  FOR EACH ROW EXECUTE PROCEDURE regras_tributarias_updated_at();
