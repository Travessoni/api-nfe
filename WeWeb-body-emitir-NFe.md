# Body JSON para WeWeb → n8n (emitir NFe)

Seu app no **WeWeb** deve enviar um **POST** para a URL do webhook do n8n com **Content-Type: application/json** e o body no formato abaixo.

---

## Requisição no WeWeb

- **Método:** `POST`
- **URL:** a URL do webhook do n8n (ex.: `https://seu-n8n.com/webhook/emitir-nfe` ou a URL que aparecer no nó "Webhook - Receber pedido")
- **Headers:** `Content-Type: application/json`
- **Body:** objeto JSON (ver estrutura abaixo)

---

## Estrutura do body (resumo)

| Campo | Obrigatório | Tipo | Descrição |
|-------|-------------|------|-----------|
| `ambiente` | Não | string | `"homologacao"` ou `"producao"`. Padrão: `"homologacao"`. |
| `referencia` | Não | string | ID único do pedido (ex.: `"PEDIDO-12345"`). Se não enviar, o n8n gera um. |
| `natureza_operacao` | Não | string | Padrão: `"Venda de mercadoria"`. |
| `valor_total` | **Sim** | string | Valor total da nota (ex.: `"150.00"`). |
| `valor_produtos` | **Sim** | string | Soma dos produtos (ex.: `"150.00"`). |
| `valor_frete` | Não | string | Padrão: `"0"`. |
| `valor_seguro` | Não | string | Padrão: `"0"`. |
| **Destinatário** | | | |
| `nome_destinatario` | **Sim** | string | Nome ou razão social. |
| `cpf_destinatario` | Um dos dois | string | CPF (apenas números ou formatado). |
| `cnpj_destinatario` | Um dos dois | string | CNPJ (apenas números ou formatado). |
| `inscricao_estadual_destinatario` | Não | string | Padrão: `"ISENTO"` se não informado. |
| `logradouro_destinatario` | **Sim** | string | |
| `numero_destinatario` | **Sim** | string | |
| `bairro_destinatario` | **Sim** | string | |
| `municipio_destinatario` | **Sim** | string | |
| `uf_destinatario` | Não | string | UF (ex.: `"SP"`, `"MG"`). Exterior: `"EX"`. Padrão: `"EX"`. |
| `pais_destinatario` | Não | string | Padrão: `"Brasil"`. |
| `cep_destinatario` | Não | string | Padrão: `"00000000"`. |
| `telefone_destinatario` | Não | string | |
| **Itens** | | | |
| `items` | **Sim** | array | Lista de produtos. Ver estrutura de cada item abaixo. |

### Estrutura de cada elemento de `items`

| Campo | Obrigatório | Tipo | Descrição |
|-------|-------------|------|-----------|
| `codigo_produto` | Não | string | Código do produto. Padrão: número do item. |
| `descricao` | **Sim** | string | Descrição do item. |
| `cfop` | Não | string | Padrão: `"5102"`. |
| `unidade_comercial` | Não | string | Padrão: `"UN"`. |
| `quantidade_comercial` | **Sim** | number | Quantidade. |
| `valor_unitario_comercial` | **Sim** | number | Preço unitário. |
| `valor_bruto` | Não | string | Total do item. Se não enviar, é calculado (quantidade × valor unitário). |
| `valor_unitario_tributavel` | Não | number | Padrão: mesmo de `valor_unitario_comercial`. |
| `unidade_tributavel` | Não | string | Padrão: `"UN"`. |
| `codigo_ncm` | Não | string | Padrão: `"00000000"`. |
| `quantidade_tributavel` | Não | number | Padrão: mesmo de `quantidade_comercial`. |
| `icms_situacao_tributaria` | Não | string | Padrão: `"400"`. |
| `icms_origem` | Não | number | Padrão: `0`. |
| `pis_situacao_tributaria` | Não | string | Padrão: `"07"`. |
| `cofins_situacao_tributaria` | Não | string | Padrão: `"07"`. |

---

## Exemplo de body completo (para copiar no WeWeb)

Use este JSON como referência. No WeWeb você pode montar o mesmo objeto com variáveis (ex.: dados do pedido, cliente e itens do carrinho).

```json
{
  "ambiente": "homologacao",
  "referencia": "PEDIDO-12345",
  "natureza_operacao": "Venda de mercadoria",
  "valor_total": "150.00",
  "valor_produtos": "150.00",
  "valor_frete": "0",
  "valor_seguro": "0",
  "nome_destinatario": "Cliente Exemplo LTDA",
  "cnpj_destinatario": "12345678000199",
  "inscricao_estadual_destinatario": "123456789",
  "logradouro_destinatario": "Av. Brasil",
  "numero_destinatario": "1000",
  "bairro_destinatario": "Centro",
  "municipio_destinatario": "São Paulo",
  "uf_destinatario": "SP",
  "pais_destinatario": "Brasil",
  "cep_destinatario": "01310100",
  "telefone_destinatario": "11999999999",
  "items": [
    {
      "codigo_produto": "PROD-001",
      "descricao": "Produto Exemplo",
      "cfop": "5102",
      "unidade_comercial": "UN",
      "quantidade_comercial": 10,
      "valor_unitario_comercial": 15,
      "valor_bruto": "150.00",
      "codigo_ncm": "12345678",
      "icms_situacao_tributaria": "400",
      "icms_origem": 0,
      "pis_situacao_tributaria": "07",
      "cofins_situacao_tributaria": "07"
    }
  ]
}
```

Arquivo de exemplo: `exemplo-body-weweb-nfe.json`.

---

## Como montar no WeWeb

1. **Resource / API externa**  
   Crie um Resource do tipo **REST API** (ou “Custom API”).  
   - URL: `https://SUA-URL-N8N/webhook/emitir-nfe`  
   - Método: **POST**  
   - Body: **JSON**.

2. **Body com variáveis**  
   No body da requisição, use a sintaxe do WeWeb para variáveis, por exemplo:
   - `{{ variables.idPedido }}` para a referência
   - `{{ variables.cliente.nome }}`, `{{ variables.cliente.cnpj }}`, etc. para o destinatário
   - `{{ variables.itensCarrinho }}` se for um array no formato dos `items` acima

3. **Exemplo de body dinâmico no WeWeb** (ajuste os nomes das variáveis ao seu app):

```json
{
  "ambiente": "homologacao",
  "referencia": "PEDIDO-{{ variables.pedido.id }}",
  "natureza_operacao": "Venda de mercadoria",
  "valor_total": "{{ variables.pedido.total }}",
  "valor_produtos": "{{ variables.pedido.subtotal }}",
  "valor_frete": "{{ variables.pedido.frete || 0 }}",
  "valor_seguro": "0",
  "nome_destinatario": "{{ variables.pedido.cliente.nome }}",
  "cnpj_destinatario": "{{ variables.pedido.cliente.cnpj }}",
  "inscricao_estadual_destinatario": "{{ variables.pedido.cliente.inscricao_estadual || 'ISENTO' }}",
  "logradouro_destinatario": "{{ variables.pedido.cliente.logradouro }}",
  "numero_destinatario": "{{ variables.pedido.cliente.numero }}",
  "bairro_destinatario": "{{ variables.pedido.cliente.bairro }}",
  "municipio_destinatario": "{{ variables.pedido.cliente.municipio }}",
  "uf_destinatario": "{{ variables.pedido.cliente.uf }}",
  "pais_destinatario": "{{ variables.pedido.cliente.pais || 'Brasil' }}",
  "cep_destinatario": "{{ variables.pedido.cliente.cep }}",
  "telefone_destinatario": "{{ variables.pedido.cliente.telefone || '' }}",
  "items": "{{ variables.pedido.itens }}"
}
```

Garanta que `variables.pedido.itens` seja um array de objetos no formato dos `items` (com `descricao`, `quantidade_comercial`, `valor_unitario_comercial`, etc.).

---

## Resposta do n8n

- **200:** NFe autorizada. O body da resposta pode trazer `ok: true`, `referencia`, `numero`, `chave_nfe`, etc.
- **422:** NFe não autorizada ou ainda em processamento. O body traz `ok: false`, `status` e `mensagem_erro`.

O WeWeb pode usar essa resposta para mostrar sucesso/erro ou redirecionar o usuário.
