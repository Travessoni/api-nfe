# Estratégia futura – Cancelamento e NFCe

Este documento descreve a estratégia recomendada para estender o módulo fiscal com **cancelamento de NFe** e **emissão de NFCe** (modelo 65), sem alterar a estrutura atual de tabelas existentes.

---

## 1. Cancelamento de NFe

### Regras SEFAZ

- Só é possível cancelar NFe **autorizada**.
- Prazo máximo para cancelamento varia por UF (geralmente até 24h ou 168h após autorização).
- Cancelamento é feito por **evento** na própria NFe (não gera novo documento).

### API Focus NFe

- **DELETE** `https://api.focusnfe.com.br/v2/nfe/{referencia}`
- Autenticação: mesmo token (Basic Auth).
- Resposta: confirmação do cancelamento ou mensagem de erro.

### Implementação sugerida

1. **Nova coluna em `fiscal_invoices` (opcional)**  
   - `cancelado_em` (timestamptz, nullable)  
   - `motivo_cancelamento` (text, nullable)  
   Ou registrar apenas em `fiscal_eventos` com `tipo_evento = 'cancelamento'` e payload com motivo e data.

2. **Endpoint**  
   - `POST /fiscal/:invoiceId/cancelar`  
   - Body: `{ "motivo": "Motivo do cancelamento" }`  
   - Validações: invoice existe; status = `AUTORIZADO`; dentro do prazo (consultar documentação da UF).  
   - Chama `DELETE /v2/nfe/{focus_id}` na Focus NFe.  
   - Atualiza `fiscal_invoices`: `status = 'CANCELADO'`, `cancelado_em = now()`, `motivo_cancelamento = motivo`.  
   - Insere em `fiscal_eventos`: `tipo_evento = 'cancelamento'`, payload com motivo e resposta Focus.

3. **Webhook**  
   - Se a Focus NFe enviar evento de cancelamento, tratar no mesmo `POST /fiscal/webhook/focusnfe` e atualizar status para `CANCELADO`.

### SQL sugerido (evolução)

```sql
-- Opcional: só se quiser guardar cancelamento na própria invoice
ALTER TABLE fiscal_invoices
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;
```

---

## 2. NFCe (modelo 65)

### Diferenças em relação à NFe (55)

- NFCe é nota de consumidor final (venda ao varejo), geralmente impressa ou em PDF.
- Ambiente e regras podem ser específicos por estado (alguns exigem certificado A1, outros permitem apenas API).
- Focus NFe suporta NFCe; endpoint e payload são diferentes da NFe (modelo 55).

### Estrutura sugerida (sem misturar com NFe 55)

- **Opção A – Mesma tabela com tipo**  
  - Adicionar `tipo_documento` em `fiscal_invoices`: `'55'` (NFe) ou `'65'` (NFCe).  
  - Manter `focus_id` como referência; na Focus, NFCe usa outro path (ex.: `/v2/nfce/...`).  
  - Sequência: usar `fiscal_sequencia` com série diferente para NFCe (ex.: série `2` para NFCe).

- **Opção B – Tabela separada**  
  - Criar `fiscal_nfce` (estrutura análoga a `fiscal_invoices`) e `fiscal_sequencia_nfce` se a numeração for independente.  
  - Menos acoplado; evita condicionais por tipo em todo o código.

### Fluxo recomendado

1. Novo endpoint: `POST /fiscal/nfce/emitir/:pedidoId` (ou por venda/danfe).
2. Serviço específico `NfceEmissaoService` que monta payload no formato **NFCe** da Focus NFe e chama o endpoint de NFCe.
3. Fila BullMQ dedicada (ex.: `fiscal-nfce-emissao`) ou mesmo fila com `tipo: 'nfce'` no job data.
4. Webhook: configurar no painel Focus uma URL que distingue NFe vs NFCe (query param ou path), ou uma única URL que lê o tipo no body e atualiza a tabela correta (`fiscal_invoices` ou `fiscal_nfce`).
5. Download XML/PDF: mesmo padrão – buscar `focus_id`, chamar API Focus e retornar stream (sem storage).

### Documentação Focus NFe

- Consultar em [Focus NFe – NFCe](https://focusnfe.com.br) a documentação específica de NFCe (payload, séries, ambiente).

---

## 3. Resumo

| Funcionalidade   | Ação principal                                      | Persistência                         |
|-----------------|-----------------------------------------------------|--------------------------------------|
| **Cancelamento**| DELETE na API Focus + atualizar status              | `fiscal_invoices` + `fiscal_eventos`  |
| **NFCe**        | Novo fluxo de emissão (payload e endpoint NFCe)    | Nova tabela ou `tipo_documento` em `fiscal_invoices` |

Mantendo: **sem alterar** `pedidos_venda`, `itens_venda`, `regras*`, `naturezaOperacao`; **sem** uso de storage para XML/PDF; download sempre sob demanda via API Focus NFe.
