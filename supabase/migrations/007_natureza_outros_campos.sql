-- ============================================================
-- Campos da aba "Outros" e incluir_frete_base_ipi na tabela de natureza
-- ============================================================

-- Tabela naturezaOperacao (nome exato com aspas para case-sensitive)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'naturezaOperacao') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'naturezaOperacao' AND column_name = 'presumido_pis_cofins') THEN
      ALTER TABLE "naturezaOperacao" ADD COLUMN presumido_pis_cofins TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'naturezaOperacao' AND column_name = 'somar_outras_despesas') THEN
      ALTER TABLE "naturezaOperacao" ADD COLUMN somar_outras_despesas TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'naturezaOperacao' AND column_name = 'aliquota_funrural') THEN
      ALTER TABLE "naturezaOperacao" ADD COLUMN aliquota_funrural NUMERIC(10, 4);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'naturezaOperacao' AND column_name = 'compra_produtor_rural') THEN
      ALTER TABLE "naturezaOperacao" ADD COLUMN compra_produtor_rural TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'naturezaOperacao' AND column_name = 'descontar_funrural') THEN
      ALTER TABLE "naturezaOperacao" ADD COLUMN descontar_funrural TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'naturezaOperacao' AND column_name = 'tipo_perc_aprox_trib') THEN
      ALTER TABLE "naturezaOperacao" ADD COLUMN tipo_perc_aprox_trib TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'naturezaOperacao' AND column_name = 'tipo_desconto') THEN
      ALTER TABLE "naturezaOperacao" ADD COLUMN tipo_desconto TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'naturezaOperacao' AND column_name = 'incluir_frete_base_ipi') THEN
      ALTER TABLE "naturezaOperacao" ADD COLUMN incluir_frete_base_ipi BOOLEAN DEFAULT true;
    END IF;
  END IF;
END $$;

-- Tabela natureza_operacao (snake_case)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'natureza_operacao') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'natureza_operacao' AND column_name = 'presumido_pis_cofins') THEN
      ALTER TABLE natureza_operacao ADD COLUMN presumido_pis_cofins TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'natureza_operacao' AND column_name = 'somar_outras_despesas') THEN
      ALTER TABLE natureza_operacao ADD COLUMN somar_outras_despesas TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'natureza_operacao' AND column_name = 'aliquota_funrural') THEN
      ALTER TABLE natureza_operacao ADD COLUMN aliquota_funrural NUMERIC(10, 4);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'natureza_operacao' AND column_name = 'compra_produtor_rural') THEN
      ALTER TABLE natureza_operacao ADD COLUMN compra_produtor_rural TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'natureza_operacao' AND column_name = 'descontar_funrural') THEN
      ALTER TABLE natureza_operacao ADD COLUMN descontar_funrural TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'natureza_operacao' AND column_name = 'tipo_perc_aprox_trib') THEN
      ALTER TABLE natureza_operacao ADD COLUMN tipo_perc_aprox_trib TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'natureza_operacao' AND column_name = 'tipo_desconto') THEN
      ALTER TABLE natureza_operacao ADD COLUMN tipo_desconto TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'natureza_operacao' AND column_name = 'incluir_frete_base_ipi') THEN
      ALTER TABLE natureza_operacao ADD COLUMN incluir_frete_base_ipi BOOLEAN DEFAULT true;
    END IF;
  END IF;
END $$;
