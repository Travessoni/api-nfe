-- Permite múltiplas NFe independentes para o mesmo pedido (remove UNIQUE em pedido_id)
ALTER TABLE fiscal_invoices DROP CONSTRAINT IF EXISTS fiscal_invoices_pedido_id_key;
