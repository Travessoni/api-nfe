-- ============================================================
-- MÓDULO FISCAL - Estrutura complementar (NÃO altera tabelas existentes)
-- NFe modelo 55 | Focus NFe | Supabase
-- ============================================================

-- 1) Notas fiscais emitidas (vinculadas ao pedido)
CREATE TABLE IF NOT EXISTS fiscal_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id BIGINT NOT NULL,
  empresa_id BIGINT NOT NULL,
  natureza_operacao_id BIGINT NOT NULL,
  numero_nf INTEGER,
  serie TEXT NOT NULL DEFAULT '1',
  focus_id TEXT,
  chave_acesso TEXT,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  xml_url TEXT,
  pdf_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pedido_id)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_pedido_id ON fiscal_invoices(pedido_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_empresa_id ON fiscal_invoices(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_focus_id ON fiscal_invoices(focus_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_status ON fiscal_invoices(status);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_created_at ON fiscal_invoices(created_at);

COMMENT ON TABLE fiscal_invoices IS 'NFe emitidas via Focus NFe - apenas metadados; XML/PDF obtidos sob demanda da API';

-- 2) Sequência de numeração por empresa/série
CREATE TABLE IF NOT EXISTS fiscal_sequencia (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  serie TEXT NOT NULL DEFAULT '1',
  ultimo_numero INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, serie)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_sequencia_empresa_serie ON fiscal_sequencia(empresa_id, serie);

COMMENT ON TABLE fiscal_sequencia IS 'Controle de numeração da NF por empresa e série';

-- 3) Eventos recebidos (webhooks Focus NFe, auditoria)
CREATE TABLE IF NOT EXISTS fiscal_eventos (
  id BIGSERIAL PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES fiscal_invoices(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_eventos_invoice_id ON fiscal_eventos(invoice_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_eventos_tipo ON fiscal_eventos(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_fiscal_eventos_created_at ON fiscal_eventos(created_at);

COMMENT ON TABLE fiscal_eventos IS 'Eventos/webhooks da Focus NFe para rastreio e auditoria';

-- Trigger updated_at para fiscal_invoices
CREATE OR REPLACE FUNCTION fiscal_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fiscal_invoices_updated_at ON fiscal_invoices;
CREATE TRIGGER trigger_fiscal_invoices_updated_at
  BEFORE UPDATE ON fiscal_invoices
  FOR EACH ROW EXECUTE PROCEDURE fiscal_invoices_updated_at();

-- Trigger updated_at para fiscal_sequencia
CREATE OR REPLACE FUNCTION fiscal_sequencia_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fiscal_sequencia_updated_at ON fiscal_sequencia;
CREATE TRIGGER trigger_fiscal_sequencia_updated_at
  BEFORE UPDATE ON fiscal_sequencia
  FOR EACH ROW EXECUTE PROCEDURE fiscal_sequencia_updated_at();

-- RLS (opcional - ajuste conforme política do projeto)
-- ALTER TABLE fiscal_invoices ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fiscal_sequencia ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fiscal_eventos ENABLE ROW LEVEL SECURITY;
