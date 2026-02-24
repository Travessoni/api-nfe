-- ============================================================
-- Função: tributação por produto_id (categoria → produto_tributacao)
-- Uma única query com JOINs; LEFT JOIN na tributação se não houver match.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_tributacao_by_produto_id(p_produto_id bigint)
RETURNS TABLE (
  categoria_id bigint,
  descricao_categoria text,
  tributacao_id bigint,
  codigo_ncm text,
  icms_origem text,
  icms_situacao_tributaria text,
  pis_situacao_tributaria text,
  cofins_situacao_tributaria text,
  tipo text,
  pis_aliquota_porcentual numeric,
  cofins_aliquota_porcentual numeric
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT DISTINCT ON (p.id)
    pc.id::bigint AS categoria_id,
    pc.descricao AS descricao_categoria,
    pt.id AS tributacao_id,
    pt.codigo_ncm,
    pt.icms_origem,
    pt.icms_situacao_tributaria,
    pt.pis_situacao_tributaria,
    pt.cofins_situacao_tributaria,
    pt.tipo,
    pt.pis_aliquota_porcentual,
    pt.cofins_aliquota_porcentual
  FROM public.produtos p
  INNER JOIN public.produto_categoria pc ON pc.id = p.categoria
  LEFT JOIN public.produto_tributacao pt
    ON pt.tipo IS NOT NULL
   AND pc.descricao IS NOT NULL
   AND TRIM(LOWER(pt.tipo)) = TRIM(LOWER(pc.descricao))
  WHERE p.id = p_produto_id
  ORDER BY p.id, pt.id NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_tributacao_by_produto_id(bigint) IS
  'Retorna categoria do produto e tributação (produto_tributacao) pelo match descricao_categoria = tipo. Uma única query com JOINs.';
