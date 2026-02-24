# Módulo Fiscal – NFe (modelo 55)

Módulo **isolado** para emissão de **NFe (modelo 55)** usando **NestJS**, **Supabase**, **Focus NFe**, **BullMQ** e **webhooks**.

- **Não altera** tabelas existentes (`pedidos_venda`, `itens_venda`, `regras*`, `naturezaOperacao`).
- **Não usa** Supabase Storage; **não persiste** XML/PDF em bucket.
- XML e PDF são obtidos **sob demanda** via API Focus NFe e retornados em **stream**.

---

## Estrutura criada

### Novas tabelas (Supabase)

| Tabela | Descrição |
|--------|-----------|
| `fiscal_invoices` | Notas fiscais emitidas (metadados; `focus_id`, `chave_acesso`, `xml_url`, `pdf_url` apenas referências) |
| `fiscal_sequencia` | Numeração da NF por `empresa_id` e `serie` |
| `fiscal_eventos` | Eventos/webhooks da Focus NFe (auditoria) |

SQL em: `supabase/migrations/001_fiscal_module.sql`.

### Fluxo de emissão

1. **POST** `/fiscal/emitir/:pedidoId` recebe o `pedido_id`.
2. **Idempotência**: se já existir `fiscal_invoice` para o pedido com status `AUTORIZADO` ou `PROCESSANDO`, retorna sem emitir de novo.
3. Busca **pedido_venda**, **itens_venda**, **empresa**, **cliente**, **naturezaOperacao** (somente leitura).
4. Obtém próximo **número da NF** em `fiscal_sequencia` (por empresa e série).
5. Cria registro em `fiscal_invoices` com status `PENDENTE` e `focus_id` = referência única.
6. Enfileira job **BullMQ** para envio à Focus NFe.
7. O **processor** monta o payload (incluindo regras tributárias padrão), chama **Focus NFe** (`POST /v2/nfe?ref=REF`) e marca status `PROCESSANDO`.
8. A **Focus NFe** processa de forma assíncrona e envia **webhook** para `POST /fiscal/webhook/focusnfe`.
9. O webhook atualiza `fiscal_invoices` (status, `chave_acesso`, `xml_url`, `pdf_url`, `error_message`) e grava em `fiscal_eventos`.
10. **Download**: `GET /fiscal/:invoiceId/xml` e `GET /fiscal/:invoiceId/pdf` buscam o `focus_id`, chamam a **API Focus NFe** e retornam o arquivo em **stream** (sem salvar em storage).

---

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/fiscal/emitir/:pedidoId` | Dispara emissão da NFe do pedido (idempotente) |
| POST | `/fiscal/webhook/focusnfe` | Webhook da Focus NFe (configurar no painel) |
| GET | `/fiscal/:invoiceId/xml` | Download do XML (stream da API Focus) |
| GET | `/fiscal/:invoiceId/pdf` | Download do PDF (stream da API Focus) |

---

## Configuração

### 1. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `FOCUS_NFE_TOKEN` (painel Focus NFe → Tokens)
- `FOCUS_NFE_AMBIENTE`: `homologacao` ou `producao`
- `REDIS_HOST`, `REDIS_PORT` (e `REDIS_PASSWORD` se houver)

### 2. Supabase

Execute a migration:

```bash
# Via Supabase CLI ou pelo painel SQL
psql $DATABASE_URL -f supabase/migrations/001_fiscal_module.sql
```

### 3. Redis (BullMQ)

O módulo usa **Redis** para a fila de emissão. Suba um Redis local ou em nuvem e informe `REDIS_*` no `.env`.

### 4. Webhook Focus NFe

No [Painel Focus NFe](https://app-v2.focusnfe.com.br) → **Webhooks**, cadastre:

- **URL**: `https://seu-dominio.com/fiscal/webhook/focusnfe`
- **Eventos**: conclusão da NFe (autorizado/rejeitado/erro)

Assim o status da nota é atualizado automaticamente sem polling.

---

## Regras importantes

- **Idempotência**: não emite duplicata para o mesmo `pedido_id` se já existir NFe autorizada ou em processamento.
- **Retry**: BullMQ com 3 tentativas e backoff exponencial (5s).
- **Rejeições**: status `REJEITADO`/`ERRO` e mensagem em `error_message`; evento salvo em `fiscal_eventos`.
- **XML/PDF**: nunca salvos em banco nem em storage; sempre obtidos da API Focus NFe no momento do download.

---

## Exemplos

- **Payload Focus NFe** (exemplo real): `exemplos/focus-nfe-payload-exemplo.json`
- **Webhook autorizado**: `exemplos/focus-nfe-webhook-exemplo-autorizado.json`
- **Webhook rejeitado**: `exemplos/focus-nfe-webhook-exemplo-rejeitado.json`

---

## Estratégia futura (cancelamento e NFCe)

Documento separado: [ESTRATEGIA-FUTURA-FISCAL.md](./ESTRATEGIA-FUTURA-FISCAL.md).

---

## Referências

- [Focus NFe – NFe](https://focusnfe.com.br/guides/nfe/)
- [Documentação técnica Focus NFe](https://doc.focusnfe.com.br)
- [NestJS](https://nestjs.com), [BullMQ](https://docs.bullmq.io), [Supabase](https://supabase.com/docs)
