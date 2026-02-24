-- ============================================================
-- Query: Tributação por produto_id (uso no Supabase SQL Editor)
-- Produtos → produto_categoria (categoria) → produto_tributacao (tipo = descricao)
-- LEFT JOIN na tributação; comparação textual segura (TRIM/LOWER).
-- ============================================================
-- Substitua :produto_id pelo ID desejado ao executar.

SELECT DISTINCT ON (p.id)
  pc.id AS categoria_id,
  pc.descricao AS descricao_categoria,
  pt.id AS produto_tributacao_id,
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
WHERE p.id = :produto_id
ORDER BY p.id, pt.id NULLS LAST;
