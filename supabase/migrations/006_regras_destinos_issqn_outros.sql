-- ============================================================
-- Regras tributárias 100% banco: destinos em todas as tabelas
-- e tabelas opcionais regrasISSQN e regrasOUTROS
-- ============================================================

-- Garantir coluna destinos em regrasRETENCOES (se a tabela existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'regrasRETENCOES') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'regrasRETENCOES' AND column_name = 'destinos'
    ) THEN
      ALTER TABLE "regrasRETENCOES" ADD COLUMN destinos TEXT;
      COMMENT ON COLUMN "regrasRETENCOES".destinos IS 'UF do destinatário (ex.: SP) ou lista (AC, SP, MG) ou "qualquer"';
    END IF;
  END IF;
END $$;

-- Tabela regrasISSQN (opcional: para uso futuro no backend)
CREATE TABLE IF NOT EXISTS regrasISSQN (
  id BIGSERIAL PRIMARY KEY,
  "naturezaRef" BIGINT NOT NULL,
  destinos TEXT,
  "situacaoTributaria" TEXT,
  aliquota NUMERIC(5, 4),
  base NUMERIC(5, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regras_issqn_natureza_ref ON regrasISSQN("naturezaRef");
COMMENT ON TABLE regrasISSQN IS 'Regras ISSQN por natureza de operação; destinos = UF ou "qualquer"';

-- Tabela regrasOUTROS (opcional: para uso futuro no backend)
CREATE TABLE IF NOT EXISTS regrasOUTROS (
  id BIGSERIAL PRIMARY KEY,
  "naturezaRef" BIGINT NOT NULL,
  destinos TEXT,
  "situacaoTributaria" TEXT,
  aliquota NUMERIC(5, 4),
  base NUMERIC(5, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regras_outros_natureza_ref ON regrasOUTROS("naturezaRef");
COMMENT ON TABLE regrasOUTROS IS 'Regras Outros por natureza de operação; destinos = UF ou "qualquer"';

-- Triggers updated_at para regrasISSQN e regrasOUTROS
DROP TRIGGER IF EXISTS trigger_regras_issqn_updated_at ON regrasISSQN;
CREATE TRIGGER trigger_regras_issqn_updated_at
  BEFORE UPDATE ON regrasISSQN
  FOR EACH ROW EXECUTE PROCEDURE regras_tributarias_updated_at();

DROP TRIGGER IF EXISTS trigger_regras_outros_updated_at ON regrasOUTROS;
CREATE TRIGGER trigger_regras_outros_updated_at
  BEFORE UPDATE ON regrasOUTROS
  FOR EACH ROW EXECUTE PROCEDURE regras_tributarias_updated_at();
