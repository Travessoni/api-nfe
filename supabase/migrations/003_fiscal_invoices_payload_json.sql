-- Armazena payload completo do rascunho ou da emissão por payload (edição no modal)
ALTER TABLE fiscal_invoices
  ADD COLUMN IF NOT EXISTS payload_json JSONB NULL;

COMMENT ON COLUMN fiscal_invoices.payload_json IS 'Payload Focus NFe (rascunho ou enviado via emitir-payload)';
