# Fluxo n8n – Focus NFe (Emissão NFe)

Fluxo de automação no **n8n** para integrar com a **API Focus NFe** e emitir **NFe** (Nota Fiscal Eletrônica), pensado para uma empresa em **Belo Horizonte (BH)** que emite notas para **todo o Brasil e exterior**.

## O que este fluxo faz

1. **Webhook** recebe um POST com os dados do pedido (emitente, destinatário, itens).
2. **Prepara o payload** no formato da Focus NFe (incluindo emitente em MG/BH e destinatário em qualquer UF ou país).
3. **Envia a NFe** para a Focus NFe (POST `/v2/nfe?ref=REFERENCIA`).
4. **Aguarda** ~45 segundos (processamento assíncrono na SEFAZ).
5. **Consulta o status** na Focus NFe (GET `/v2/nfe/REFERENCIA`).
6. **Responde ao webhook** com sucesso (autorizada) ou erro/ainda em processamento.

## Pré-requisitos

- Conta na [Focus NFe](https://focusnfe.com.br) e empresa emitente cadastrada (BH/MG).
- **Token de acesso** (homologação e/ou produção) no [Painel Focus NFe](https://app-v2.focusnfe.com.br) → Tokens.
- n8n instalado (self-hosted ou n8n.cloud).

## Importar o workflow no n8n

1. Abra o n8n.
2. Menu **Workflows** → **Import from File** (ou **Import from URL** se você hospedar o JSON).
3. Selecione o arquivo `n8n-workflow-focus-nfe-emissao-nfe.json`.
4. Crie a credencial **Focus NFe API** (veja abaixo) e associe aos nós **Focus NFe - Emitir NFe** e **Focus NFe - Consultar status**.

## Credencial Focus NFe no n8n

A Focus NFe usa **HTTP Basic Auth**: usuário = token, senha = em branco.

1. No n8n: **Settings** → **Credentials** → **Add credential**.
2. Escolha **Header Auth** (ou **Generic Credential Type** com **HTTP Header Auth**).
3. Nome: `Focus NFe API`.
4. Configure:
   - **Name**: `Authorization`
   - **Value**: `Basic BASE64`
     - Gere o Base64 de `SEU_TOKEN:` (token + dois pontos + nada).  
     - Exemplo em terminal:  
       `echo -n "SEU_TOKEN:" | base64`
5. Nos nós **Focus NFe - Emitir NFe** e **Focus NFe - Consultar status**, selecione essa credencial.

Se o n8n tiver tipo **HTTP Basic Auth**:
- **User**: cole o token da Focus NFe.
- **Password**: deixe em branco.

## Ambiente: Homologação x Produção

- No body do webhook você pode enviar **`"ambiente": "homologacao"`** ou **`"ambiente": "producao"`**.
- Se não enviar, o padrão é **homologação**.
- URLs usadas pelo fluxo:
  - **Homologação**: `https://homologacao.focusnfe.com.br`
  - **Produção**: `https://api.focusnfe.com.br`

Use **homologação** para testes e **produção** apenas quando for emitir notas com valor fiscal.

## Exemplo de body do Webhook (POST)

Empresa em BH emitindo para um cliente em outro estado ou exterior:

```json
{
  "ambiente": "homologacao",
  "referencia": "PEDIDO-12345",
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
  "natureza_operacao": "Venda de mercadoria",
  "valor_total": "100.00",
  "valor_produtos": "100.00",
  "items": [
    {
      "codigo_produto": "PROD-001",
      "descricao": "Produto Exemplo",
      "cfop": "5102",
      "unidade_comercial": "UN",
      "quantidade_comercial": 10,
      "valor_unitario_comercial": 10.00,
      "valor_bruto": "100.00",
      "codigo_ncm": "12345678",
      "icms_situacao_tributaria": "400",
      "icms_origem": 0,
      "pis_situacao_tributaria": "07",
      "cofins_situacao_tributaria": "07"
    }
  ]
}
```

**Destinatário no exterior:** use `"uf_destinatario": "EX"` e `"pais_destinatario": "Nome do País"`. Ajuste CFOP e demais regras com seu contador.

**Emitente (BH):** se não enviar no body, o nó “Preparar payload NFe” usa valores padrão (ex.: Belo Horizonte, MG). Edite o nó **Preparar payload NFe** e preencha `cnpj_emitente`, `nome_emitente`, `inscricao_estadual_emitente`, endereço etc. com os dados reais da sua empresa.

## Webhook da Focus NFe (recomendado)

A Focus NFe recomenda **webhooks** em vez de polling. Você pode:

1. **Manter este fluxo** para envio + uma espera + uma consulta (como está).
2. **Ou** configurar no painel Focus NFe uma URL do n8n (ex.: outro Webhook) que receberá o POST quando a NFe for processada; assim você não depende do tempo fixo de 45s e pode reagir assim que a nota for autorizada ou rejeitada.

Para isso, crie um segundo workflow no n8n com um **Webhook** que receba o POST da Focus NFe e atualize seu sistema (ERP, e-mail, etc.).

## Cancelamento e Carta de Correção

Este workflow cobre apenas **emissão** e **consulta**. Para **cancelamento** e **carta de correção** use a própria API Focus NFe:

- **Cancelar**: `DELETE https://api.focusnfe.com.br/v2/nfe/REFERENCIA`
- **Carta de correção**: `POST https://api.focusnfe.com.br/v2/nfe/REFERENCIA/carta_correcao`

Você pode adicionar nós **HTTP Request** no n8n para essas operações, usando a mesma credencial e a mesma `referencia` retornada na emissão.

## Referências

- [Focus NFe – Passo a passo NFe](https://focusnfe.com.br/guides/nfe/)
- [Focus NFe – Passos iniciais](https://focusnfe.com.br/guides/passos-iniciais/)
- [Documentação técnica Focus NFe](https://focusnfe.com.br/doc/)
- [Ambientes: homologação x produção](https://focusnfe.com.br/doc/) (homologacao.focusnfe.com.br vs api.focusnfe.com.br)
