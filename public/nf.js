/* global flatpickr, lucide */
const API = ''; // same origin

function setElMessage(el, text, type) {
  if (!el) return;
  el.textContent = text || '';
  el.className = 'message ' + (type || 'info');
  el.style.display = text ? 'block' : 'none';
}

function setPageMessage(text, type) {
  setElMessage(document.getElementById('nfPageMessage'), text, type);
}

function setFormMessage(text, type) {
  setElMessage(document.getElementById('modalAdicionarNFMessage'), text, type);
}

function onlyNumbers(s) {
  if (!s) return '';
  return String(s).replace(/\D/g, '');
}

function stripIdSuffix(label) {
  if (!label) return '';
  return String(label).replace(/\s*\(ID\s*\d+\)\s*$/i, '').trim();
}

// ---------------------- Cliente derivado do pedido ----------------------
var modalNFContext = { pedidoId: 0, empresaId: 0, naturezaId: 0 };
var selectedContatoId = null;

function updateClienteBtnIcon() {
  var btn = document.getElementById('nf_cliente_btn_add_edit');
  if (!btn) return;
  btn.innerHTML = selectedContatoId ? '<i data-lucide="pen"></i>' : '<i data-lucide="plus"></i>';
  btn.setAttribute('aria-label', selectedContatoId ? 'Editar cliente' : 'Adicionar cliente');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function setClienteUI(nome, contatoId) {
  var inputEl = document.getElementById('nf_cliente_busca');
  var hiddenEl = document.getElementById('nf_nome_destinatario');
  var n = nome != null ? String(nome).trim() : '';
  if (inputEl) inputEl.value = n;
  if (hiddenEl) hiddenEl.value = n;
  selectedContatoId = contatoId != null && !isNaN(Number(contatoId)) ? Number(contatoId) : null;
  var listEl = document.getElementById('nf_cliente_contatos_list');
  if (listEl) { listEl.innerHTML = ''; listEl.style.display = 'none'; }
  updateClienteBtnIcon();
}

function resolveClienteFromPedido(pedidoId) {
  pedidoId = pedidoId ? parseInt(String(pedidoId), 10) : 0;
  if (!pedidoId || pedidoId < 1) {
    setClienteUI('', null);
    return Promise.resolve(null);
  }
  return fetch(API + '/fiscal/pedidos/' + pedidoId + '/cliente')
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
    .then(function (result) {
      if (!result.ok || !result.data || typeof result.data !== 'object') return null;
      var contatoId = result.data.contato_id != null ? Number(result.data.contato_id) : null;
      var nome = result.data.nome != null ? String(result.data.nome) : '';
      setClienteUI(nome || '', contatoId);
      return result.data;
    })
    .catch(function () { return null; });
}

// ---------------------- CPF/CNPJ dinâmico ----------------------
function maskCPF(v) {
  var d = onlyNumbers(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3);
  if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
  return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
}

function maskCNPJ(v) {
  var d = onlyNumbers(v).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return d.slice(0, 2) + '.' + d.slice(2);
  if (d.length <= 8) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5);
  if (d.length <= 12) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8);
  return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12);
}

function isValidCPF(digits) {
  if (!digits || digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  var sum = 0; for (var i = 0; i < 9; i++) sum += parseInt(digits[i], 10) * (10 - i);
  var d1 = (sum * 10) % 11; if (d1 === 10) d1 = 0; if (d1 !== parseInt(digits[9], 10)) return false;
  sum = 0; for (i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * (11 - i);
  var d2 = (sum * 10) % 11; if (d2 === 10) d2 = 0; if (d2 !== parseInt(digits[10], 10)) return false;
  return true;
}

function isValidCNPJ(digits) {
  if (!digits || digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  var w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  var sum = 0; for (var i = 0; i < 12; i++) sum += parseInt(digits[i], 10) * w1[i];
  var d1 = sum % 11; d1 = d1 < 2 ? 0 : 11 - d1; if (d1 !== parseInt(digits[12], 10)) return false;
  var w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0; for (i = 0; i < 13; i++) sum += parseInt(digits[i], 10) * w2[i];
  var d2 = sum % 11; d2 = d2 < 2 ? 0 : 11 - d2; if (d2 !== parseInt(digits[13], 10)) return false;
  return true;
}

function validateDocDest() {
  var tipo = document.getElementById('nf_tipo_pessoa_dest').value;
  var inp = document.getElementById('nf_cpf_cnpj_dest');
  var digits = onlyNumbers(inp ? inp.value : '');
  if (!tipo) return { valid: false, error: 'Selecione o tipo de pessoa' };
  if (!digits) return { valid: false, error: 'Informe o documento' };
  if (tipo === 'pf') {
    if (digits.length !== 11) return { valid: false, error: 'CPF deve ter 11 dígitos' };
    if (!isValidCPF(digits)) return { valid: false, error: 'CPF inválido' };
  } else {
    if (digits.length !== 14) return { valid: false, error: 'CNPJ deve ter 14 dígitos' };
    if (!isValidCNPJ(digits)) return { valid: false, error: 'CNPJ inválido' };
  }
  return { valid: true };
}

function setDocDestError(msg) {
  var wrap = document.getElementById('nf_doc_dest_wrap');
  var errEl = document.getElementById('nf_doc_dest_error');
  if (wrap) wrap.classList.add('has-error');
  if (errEl) { errEl.textContent = msg || ''; errEl.style.display = msg ? 'block' : 'none'; }
}

function clearDocDestError() {
  var wrap = document.getElementById('nf_doc_dest_wrap');
  var errEl = document.getElementById('nf_doc_dest_error');
  if (wrap) wrap.classList.remove('has-error');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
}

function updateDocDestUI() {
  var tipo = document.getElementById('nf_tipo_pessoa_dest').value;
  var labelEl = document.getElementById('nf_doc_dest_label');
  var inp = document.getElementById('nf_cpf_cnpj_dest');
  if (labelEl) labelEl.textContent = tipo === 'pf' ? 'CPF' : tipo === 'pj' ? 'CNPJ' : 'CPF ou CNPJ';
  if (inp) {
    inp.placeholder = tipo === 'pf' ? '000.000.000-00' : tipo === 'pj' ? '00.000.000/0000-00' : 'Selecione o tipo de pessoa';
    inp.maxLength = tipo === 'pf' ? 14 : tipo === 'pj' ? 18 : 18;
    var digits = onlyNumbers(inp.value);
    inp.value = tipo === 'pf' ? maskCPF(digits) : tipo === 'pj' ? maskCNPJ(digits) : digits;
  }
  clearDocDestError();
}

// ---------------------- ViaCEP ----------------------
function buscaCep(cepInputId, logradouroId, bairroId, municipioId, ufId) {
  var cepEl = document.getElementById(cepInputId);
  if (!cepEl) return;
  var cep = onlyNumbers(cepEl.value);
  if (cep.length !== 8) return;
  fetch('https://viacep.com.br/ws/' + cep + '/json/')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.erro) {
        setFormMessage('CEP não encontrado.', 'error');
        return;
      }
      var logEl = document.getElementById(logradouroId);
      var bairroEl = document.getElementById(bairroId);
      var municipioEl = document.getElementById(municipioId);
      var ufEl = document.getElementById(ufId);
      if (logEl) logEl.value = data.logradouro || '';
      if (bairroEl) bairroEl.value = data.bairro || '';
      if (municipioEl) municipioEl.value = data.localidade || '';
      if (ufEl) ufEl.value = data.uf || '';
      setFormMessage('');
      updateLocalDestinoFromUFs();
    })
    .catch(function () {
      setFormMessage('Erro ao consultar CEP.', 'error');
    });
}

// ---------------------- Flatpickr ----------------------
var fpDataEmissao, fpDataEntradaSaida;
function initFlatpickr() {
  var fpOpts = {
    enableTime: true,
    time_24hr: true,
    enableSeconds: true,
    minuteIncrement: 1,
    locale: 'pt',
    dateFormat: 'Y-m-d\\TH:i:S',
    altInput: true,
    altFormat: 'd/m/Y, H:i:S',
    altInputClass: 'form-datetime-alt',
    allowInput: false
  };
  fpDataEmissao = flatpickr('#nf_data_emissao', fpOpts);
  fpDataEntradaSaida = flatpickr('#nf_data_entrada_saida', fpOpts);
}

// ---------------------- Itens / cálculo ----------------------
function formatValorBruto(item) {
  var q = Number(item.quantidade_comercial ?? 0);
  var v = Number(item.valor_unitario_comercial ?? 0);
  var total = Math.round(q * v * 100) / 100;
  return total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function updateModalCalcTotais(forceUpdate) {
  var toggle = document.getElementById('nfCalcAutoToggle');
  if (!forceUpdate && (!toggle || !toggle.classList.contains('on'))) return;
  var tbody = document.getElementById('nfItemsBody');
  if (!tbody) return;
  var CST_COM_BC = ['00', '10', '20', '51', '70', '90'];
  var DEFAULT_PERC_APROX_TRIB = 15.25;
  var PERC_FEDERAIS = 13.45;
  var PERC_ESTADUAIS = 1.80;
  var totProdutos = 0, baseIcms = 0, valorIcms = 0, baseIcmsSt = 0, valorIcmsSt = 0, valorIpi = 0;
  var valorPis = 0, valorCofins = 0;
  var rows = tbody.querySelectorAll('tr');
  var vBrutos = [];
  rows.forEach(function (tr) {
    var totalEl = tr.querySelector('.valor-bruto-display');
    var qInp = tr.querySelector('input[data-field="quantidade_comercial"]');
    var vInp = tr.querySelector('input[data-field="valor_unitario_comercial"]');
    var vBruto = 0;
    if (totalEl) {
      var txt = (totalEl.value || '').replace(/\./g, '').replace(',', '.');
      vBruto = parseFloat(txt) || 0;
    } else if (qInp && vInp) {
      vBruto = (parseFloat(qInp.value) || 0) * (parseFloat(vInp.value) || 0);
      vBruto = Math.round(vBruto * 100) / 100;
    }
    totProdutos += vBruto;
    vBrutos.push(vBruto);
  });
  var frete = parseFloat(document.getElementById('nf_valor_frete').value) || 0;
  var freteRounded = Math.round(frete * 100) / 100;
  var fretePorItem = [];
  if (freteRounded > 0 && rows.length > 0) {
    if (rows.length === 1) {
      fretePorItem[0] = freteRounded;
    } else {
      var totSafe = totProdutos > 0 ? totProdutos : 1;
      var somaF = 0;
      for (var i = 0; i < rows.length; i++) {
        var fItem = Math.round((vBrutos[i] / totSafe) * freteRounded * 100) / 100;
        fretePorItem.push(fItem);
        somaF += fItem;
      }
      var diff = Math.round((freteRounded - somaF) * 100) / 100;
      if (diff !== 0) fretePorItem[rows.length - 1] = Math.round((fretePorItem[rows.length - 1] + diff) * 100) / 100;
    }
  } else {
    for (var j = 0; j < rows.length; j++) fretePorItem.push(0);
  }
  rows.forEach(function (tr, idx) {
    var vBruto = vBrutos[idx] || 0;
    var valorFreteItem = fretePorItem[idx] != null ? fretePorItem[idx] : (parseFloat(tr.dataset.valorFrete) || 0);
    var baseItem = Math.round((vBruto + valorFreteItem) * 100) / 100;
    var cst = (tr.dataset.icmsSt || '400').trim();
    if (CST_COM_BC.indexOf(cst) >= 0) {
      baseIcms += baseItem;
      var aliqIcms = parseFloat(tr.dataset.icmsAliquota) || 0;
      valorIcms += Math.round(baseItem * aliqIcms) / 100;
    } else {
      valorIcms += parseFloat(tr.dataset.icmsValor) || 0;
    }
    baseIcmsSt += parseFloat(tr.dataset.icmsBaseSt) || 0;
    valorIcmsSt += parseFloat(tr.dataset.icmsValorSt) || 0;
    valorIpi += parseFloat(tr.dataset.ipiValor) || 0;
    var pisV = parseFloat(tr.dataset.pisValor);
    if (!isNaN(pisV)) valorPis += pisV;
    else {
      var basePis = parseFloat(tr.dataset.pisBaseCalculo) || 100;
      var aliqPis = parseFloat(tr.dataset.pisAliquotaPorcentual) || 0;
      valorPis += Math.round(baseItem * (basePis / 100) * (aliqPis / 100) * 100) / 100;
    }
    var cofV = parseFloat(tr.dataset.cofinsValor);
    if (!isNaN(cofV)) valorCofins += cofV;
    else {
      var baseCof = parseFloat(tr.dataset.cofinsBaseCalculo) || 100;
      var aliqCof = parseFloat(tr.dataset.cofinsAliquotaPorcentual) || 0;
      valorCofins += Math.round(baseItem * (baseCof / 100) * (aliqCof / 100) * 100) / 100;
    }
  });
  var desconto = parseFloat(document.getElementById('nf_valor_desconto').value) || 0;
  var totalNota = Math.round((totProdutos + frete - desconto) * 100) / 100;
  // Total A. Tributos (Lei 12.741): valor aproximado = % sobre o total da nota (produtos + frete - desconto)
  var totalTributos = totalNota > 0 ? Math.round(totalNota * (DEFAULT_PERC_APROX_TRIB / 100) * 100) / 100 : 0;
  function setNum(id, v) {
    var el = document.getElementById(id);
    if (el) el.value = v != null && !isNaN(v) ? String(Math.round(v * 100) / 100) : '0';
  }
  setNum('nf_total_produtos', totProdutos);
  setNum('nf_valor_produtos', totProdutos);
  setNum('nf_valor_frete_calc', frete);
  setNum('nf_valor_seguro_calc', 0);
  setNum('nf_outras_despesas', 0);
  setNum('nf_desconto_calc', desconto);
  setNum('nf_total_nota', totalNota);
  setNum('nf_valor_total', totalNota);
  setNum('nf_base_icms', baseIcms);
  setNum('nf_valor_icms', valorIcms);
  setNum('nf_base_icms_st', baseIcmsSt);
  setNum('nf_valor_icms_st', valorIcmsSt);
  setNum('nf_valor_ipi', valorIpi);
  setNum('nf_total_servicos', 0);
  setNum('nf_valor_issqn', 0);
  setNum('nf_valor_funrural', 0);
  setNum('nf_total_faturado', totalNota);
  setNum('nf_total_tributos', totalTributos);
  // Atualiza texto de informações adicionais:
  // - parte inicial: texto livre (infoAdicionais / edição do usuário)
  // - parte final: bloco IBPT \"Total aproximado de tributos...\"
  var infoEl = document.getElementById('nf_info_complementares');
  if (infoEl) {
    var current = String(infoEl.value || '');
    var marker = 'Total aproximado de tributos';
    var idx = current.indexOf(marker);
    var baseNatureza = idx >= 0 ? current.slice(0, idx).trimEnd() : current.trimEnd();
    var newValue = baseNatureza;
    if (totalTributos > 0) {
      var tribTotal = Math.round(totalTributos * 100) / 100;
      var fatorFed = PERC_FEDERAIS / DEFAULT_PERC_APROX_TRIB;
      var tribFederais = Math.round(tribTotal * fatorFed * 100) / 100;
      var tribEstaduais = Math.round((tribTotal - tribFederais) * 100) / 100;
      var fmt = function (v) {
        return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };
      var ibptText =
        'Total aproximado de tributos: R$ ' + fmt(tribTotal) + ' (' + DEFAULT_PERC_APROX_TRIB.toString().replace('.', ',') + '%) ' +
        'Federais R$ ' + fmt(tribFederais) + ' (' + PERC_FEDERAIS.toString().replace('.', ',') + '%) ' +
        'Estaduais R$ ' + fmt(tribEstaduais) + ' (' + PERC_ESTADUAIS.toString().replace('.', ',') + '%). ' +
        'Fonte IBPT.';
      newValue = baseNatureza ? baseNatureza + '\n\n' + ibptText : ibptText;
    }
    infoEl.value = newValue;
  }
}

function updateValorBruto(tr) {
  var qInp = tr.querySelector('input[data-field="quantidade_comercial"]');
  var vInp = tr.querySelector('input[data-field="valor_unitario_comercial"]');
  var totalEl = tr.querySelector('.valor-bruto-display');
  if (!totalEl || !qInp || !vInp) return;
  var q = parseFloat(qInp.value) || 0;
  var v = parseFloat(vInp.value) || 0;
  var total = Math.round(q * v * 100) / 100;
  totalEl.value = total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  updateModalCalcTotais();
}

function renumberItems() {
  document.getElementById('nfItemsBody').querySelectorAll('tr').forEach(function (tr, i) {
    var first = tr.querySelector('td.col-num');
    if (first) first.textContent = i + 1;
  });
}

function addItemRow(item, num) {
  item = item || {};
  var tbody = document.getElementById('nfItemsBody');
  var tr = document.createElement('tr');
  var descVal = (item.descricao || '').replace(/"/g, '&quot;');
  tr.innerHTML =
    '<td class="col-num col-item-num">' + (num || tbody.querySelectorAll('tr').length + 1) + '</td>' +
    '<td class="col-desc"><div class="nf-produto-ac-wrap"><input type="text" data-field="descricao" value="' + descVal + '" autocomplete="off" placeholder="Buscar por nome"><ul class="nf-produto-ac-list"></ul></div></td>' +
    '<td class="col-codigo"><input type="text" data-field="codigo_produto" value="' + (item.codigo_produto || '').replace(/"/g, '&quot;') + '"></td>' +
    '<td class="col-ncm"><input type="text" data-field="codigo_ncm" value="' + (item.codigo_ncm || '').replace(/"/g, '&quot;') + '" maxlength="8"></td>' +
    '<td class="col-un"><input type="text" data-field="unidade_comercial" value="' + (item.unidade_comercial || 'UN').replace(/"/g, '&quot;') + '"></td>' +
    '<td class="col-160"><input type="number" data-field="quantidade_comercial" step="0.01" min="0" value="' + (item.quantidade_comercial ?? '') + '"></td>' +
    '<td class="col-160"><input type="number" data-field="valor_unitario_comercial" step="0.01" min="0" value="' + (item.valor_unitario_comercial ?? '') + '"></td>' +
    '<td class="col-160"><input type="text" class="valor-bruto-display nf-readonly" value="' + formatValorBruto(item) + '" readonly></td>' +
    '<td class="col-del"><span class="col-del-btns"><button type="button" class="btn-lupa btn-edit-item" aria-label="Editar"><i data-lucide="pen"></i></button><button type="button" class="btn-lupa btn-remove-item" aria-label="Remover"><i data-lucide="trash-2"></i></button></span></td>';

  if (item.icms_situacao_tributaria) tr.dataset.icmsSt = item.icms_situacao_tributaria;
  if (item.icms_origem != null && item.icms_origem !== '') tr.dataset.icmsOrigem = String(item.icms_origem);
  if (item.pis_situacao_tributaria) tr.dataset.pisSt = item.pis_situacao_tributaria;
  if (item.cofins_situacao_tributaria) tr.dataset.cofinsSt = item.cofins_situacao_tributaria;
  if (item.cfop) tr.dataset.cfop = item.cfop;
  if (item.tipo != null && item.tipo !== '') tr.dataset.tipo = String(item.tipo);
  if (item.pis_aliquota_porcentual != null && item.pis_aliquota_porcentual !== '') tr.dataset.pisAliquotaPorcentual = String(item.pis_aliquota_porcentual);
  if (item.cofins_aliquota_porcentual != null && item.cofins_aliquota_porcentual !== '') tr.dataset.cofinsAliquotaPorcentual = String(item.cofins_aliquota_porcentual);
  if (item.pis_base_calculo != null && item.pis_base_calculo !== '') tr.dataset.pisBaseCalculo = String(item.pis_base_calculo);
  if (item.cofins_base_calculo != null && item.cofins_base_calculo !== '') tr.dataset.cofinsBaseCalculo = String(item.cofins_base_calculo);
  if (item.pis_valor != null && item.pis_valor !== '') tr.dataset.pisValor = String(item.pis_valor);
  if (item.cofins_valor != null && item.cofins_valor !== '') tr.dataset.cofinsValor = String(item.cofins_valor);
  if (item.icms_modalidade_base_calculo != null && item.icms_modalidade_base_calculo !== '') tr.dataset.icmsModalidadeBaseCalculo = String(item.icms_modalidade_base_calculo);
  if (item.icms_aliquota != null && item.icms_aliquota !== '') tr.dataset.icmsAliquota = String(item.icms_aliquota);
  if (item.icms_valor != null && item.icms_valor !== '') tr.dataset.icmsValor = String(item.icms_valor);
  if (item.ipi_situacao_tributaria != null && item.ipi_situacao_tributaria !== '') tr.dataset.ipiSt = String(item.ipi_situacao_tributaria);
  if (item.ipi_codigo_enquadramento_legal != null && item.ipi_codigo_enquadramento_legal !== '') tr.dataset.ipiCodEnquadramento = String(item.ipi_codigo_enquadramento_legal);
  if (item.valor_frete != null && item.valor_frete !== '') tr.dataset.valorFrete = String(item.valor_frete);
  else tr.dataset.valorFrete = '0';

  tbody.appendChild(tr);

  var descInput = tr.querySelector('input[data-field="descricao"]');
  var listEl = tr.querySelector('.nf-produto-ac-list');
  var acTimeout;
  function hideList() { listEl.style.display = 'none'; listEl.innerHTML = ''; }
  function showList(items) {
    listEl.innerHTML = '';
    items.forEach(function (p) {
      var li = document.createElement('li');
      li.textContent = (p.nome || '') + (p.sku ? ' (SKU: ' + p.sku + ')' : '');
      li.dataset.id = String(p.id);
      li.dataset.nome = p.nome || '';
      li.dataset.sku = p.sku || '';
      li.dataset.preco = p.preco != null ? String(p.preco) : '';
      li.addEventListener('click', function () {
        descInput.value = li.dataset.nome || '';
        var codigoInp = tr.querySelector('input[data-field="codigo_produto"]');
        if (codigoInp) codigoInp.value = li.dataset.sku || li.dataset.id || '';
        var precoInp = tr.querySelector('input[data-field="valor_unitario_comercial"]');
        if (precoInp && li.dataset.preco) precoInp.value = li.dataset.preco;
        updateValorBruto(tr);
        if (li.dataset.id) {
          fetch(API + '/fiscal/produtos/' + encodeURIComponent(li.dataset.id) + '/tributacao')
            .then(function (r) { return r.json(); })
            .then(function (trib) {
              if (!trib || trib.message) return;
              var ncmInp = tr.querySelector('input[data-field="codigo_ncm"]');
              if (ncmInp && trib.codigo_ncm) ncmInp.value = trib.codigo_ncm;
              tr.dataset.icmsOrigem = trib.icms_origem || '';
              tr.dataset.icmsSt = trib.icms_situacao_tributaria || '';
              tr.dataset.pisSt = trib.pis_situacao_tributaria || '';
              tr.dataset.cofinsSt = trib.cofins_situacao_tributaria || '';
              if (trib.tipo != null && trib.tipo !== '') tr.dataset.tipo = String(trib.tipo);
              if (trib.pis_aliquota_porcentual != null && trib.pis_aliquota_porcentual !== '') tr.dataset.pisAliquotaPorcentual = String(trib.pis_aliquota_porcentual);
              if (trib.cofins_aliquota_porcentual != null && trib.cofins_aliquota_porcentual !== '') tr.dataset.cofinsAliquotaPorcentual = String(trib.cofins_aliquota_porcentual);
            })
            .catch(function () { });
        }
        hideList();
      });
      listEl.appendChild(li);
    });
    listEl.style.display = items.length ? 'block' : 'none';
  }
  descInput.addEventListener('input', function () {
    clearTimeout(acTimeout);
    var q = descInput.value.trim();
    if (q.length < 2) { hideList(); return; }
    acTimeout = setTimeout(function () {
      fetch(API + '/fiscal/produtos?q=' + encodeURIComponent(q))
        .then(function (r) { return r.json(); })
        .then(function (arr) { showList(Array.isArray(arr) ? arr : []); })
        .catch(function () { hideList(); });
    }, 300);
  });
  descInput.addEventListener('focus', function () {
    var q = descInput.value.trim();
    if (q.length >= 2) fetch(API + '/fiscal/produtos?q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (arr) { showList(Array.isArray(arr) ? arr : []); });
  });
  descInput.addEventListener('blur', function () { setTimeout(hideList, 200); });
  var qtdInp = tr.querySelector('input[data-field="quantidade_comercial"]');
  var valUnitInp = tr.querySelector('input[data-field="valor_unitario_comercial"]');
  if (qtdInp) qtdInp.addEventListener('input', function () { updateValorBruto(tr); });
  if (valUnitInp) valUnitInp.addEventListener('input', function () { updateValorBruto(tr); });
  tr.querySelector('.btn-remove-item').addEventListener('click', function () {
    tr.remove();
    renumberItems();
    updateModalCalcTotais();
  });
  tr.querySelector('.btn-edit-item').addEventListener('click', function () { openSheetItemNF(tr); });
  if (typeof lucide !== 'undefined') lucide.createIcons();
  updateModalCalcTotais();
}

// ---------------------- Sheet item ----------------------
var sheetItemNFRow = null;

function updateSheetPisCofinsValor() {
  var valorTotal = parseFloat(document.getElementById('sheet_valor_bruto').value) || 0;
  var basePis = parseFloat(document.getElementById('sheet_pis_base').value) || 100;
  var aliqPis = parseFloat(document.getElementById('sheet_pis_aliquota').value) || 0;
  var baseCofins = parseFloat(document.getElementById('sheet_cofins_base').value) || 100;
  var aliqCofins = parseFloat(document.getElementById('sheet_cofins_aliquota').value) || 0;
  var valorPis = Math.round(valorTotal * (basePis / 100) * (aliqPis / 100) * 100) / 100;
  var valorCofins = Math.round(valorTotal * (baseCofins / 100) * (aliqCofins / 100) * 100) / 100;
  document.getElementById('sheet_pis_valor').value = valorPis;
  document.getElementById('sheet_cofins_valor').value = valorCofins;
}

function openSheetItemNF(tr) {
  sheetItemNFRow = tr;
  var item = {};
  tr.querySelectorAll('input[data-field]').forEach(function (inp) {
    var f = inp.getAttribute('data-field');
    var v = inp.value;
    if (f === 'quantidade_comercial') item[f] = parseFloat(v) || 0;
    else if (f === 'valor_unitario_comercial') item[f] = parseFloat(v) || 0;
    else if (v) item[f] = v;
  });
  var totalEl = tr.querySelector('.valor-bruto-display');
  if (totalEl) item.valor_bruto = parseFloat((totalEl.value || '').replace(/\./g, '').replace(',', '.')) || 0;
  item.codigo_ncm = (item.codigo_ncm || '').replace(/\D/g, '').padStart(8, '0').slice(0, 8) || '00000000';
  var ufEmitente = (document.getElementById('nf_uf_emitente') && document.getElementById('nf_uf_emitente').value || 'MG').trim().toUpperCase();
  var ufDestinatario = ((document.getElementById('nf_uf_destinatario') && document.getElementById('nf_uf_destinatario').value) || '').trim().toUpperCase();
  var isInterestadual = ufEmitente.length === 2 && ufDestinatario.length === 2 && ufEmitente !== ufDestinatario;
  item.cfop = cfopPorDestino(tr.dataset.cfop || item.cfop || '5102', isInterestadual);
  item.icms_situacao_tributaria = tr.dataset.icmsSt || item.icms_situacao_tributaria || '400';
  item.icms_origem = tr.dataset.icmsOrigem || item.icms_origem || '0';
  item.pis_situacao_tributaria = tr.dataset.pisSt || item.pis_situacao_tributaria || '07';
  item.cofins_situacao_tributaria = tr.dataset.cofinsSt || item.cofins_situacao_tributaria || '07';
  item.tipo = tr.dataset.tipo || item.tipo || '';
  item.pis_aliquota_porcentual = tr.dataset.pisAliquotaPorcentual || item.pis_aliquota_porcentual || '';
  item.cofins_aliquota_porcentual = tr.dataset.cofinsAliquotaPorcentual || item.cofins_aliquota_porcentual || '';
  item.pis_base_calculo = tr.dataset.pisBaseCalculo || item.pis_base_calculo || '100.0000';
  item.cofins_base_calculo = tr.dataset.cofinsBaseCalculo || item.cofins_base_calculo || '100.0000';
  item.pis_valor = tr.dataset.pisValor || item.pis_valor || '';
  item.cofins_valor = tr.dataset.cofinsValor || item.cofins_valor || '';
  item.icms_modalidade_base_calculo = tr.dataset.icmsModalidadeBaseCalculo || item.icms_modalidade_base_calculo || '';
  item.icms_aliquota = tr.dataset.icmsAliquota || item.icms_aliquota || '';
  item.icms_valor = tr.dataset.icmsValor || item.icms_valor || '';
  item.ipi_situacao_tributaria = tr.dataset.ipiSt || item.ipi_situacao_tributaria || '53';
  item.ipi_codigo_enquadramento_legal = tr.dataset.ipiCodEnquadramento || item.ipi_codigo_enquadramento_legal || '';
  item.valor_frete = tr.dataset.valorFrete != null && tr.dataset.valorFrete !== '' ? tr.dataset.valorFrete : (item.valor_frete != null ? item.valor_frete : '0');
  document.querySelectorAll('#sheetItemNF input[data-field], #sheetItemNF select[data-field], #sheetItemNF textarea[data-field]').forEach(function (el) {
    var f = el.getAttribute('data-field');
    if (!f) return;
    var v = item[f];
    if (v !== undefined && v !== null) el.value = v;
  });
  var pisAliqVal = (tr.dataset.pisAliquotaPorcentual != null && tr.dataset.pisAliquotaPorcentual !== '') ? tr.dataset.pisAliquotaPorcentual : (item.pis_aliquota_porcentual != null && item.pis_aliquota_porcentual !== '') ? String(item.pis_aliquota_porcentual) : '';
  var cofinsAliqVal = (tr.dataset.cofinsAliquotaPorcentual != null && tr.dataset.cofinsAliquotaPorcentual !== '') ? tr.dataset.cofinsAliquotaPorcentual : (item.cofins_aliquota_porcentual != null && item.cofins_aliquota_porcentual !== '') ? String(item.cofins_aliquota_porcentual) : '';
  var sheetPisEl = document.getElementById('sheet_pis_aliquota');
  var sheetCofinsEl = document.getElementById('sheet_cofins_aliquota');
  if (sheetPisEl) sheetPisEl.value = pisAliqVal;
  if (sheetCofinsEl) sheetCofinsEl.value = cofinsAliqVal;
  var vBruto = (item.quantidade_comercial || 0) * (item.valor_unitario_comercial || 0);
  var vBrutoEl = document.getElementById('sheet_valor_bruto');
  if (vBrutoEl) vBrutoEl.value = Math.round(vBruto * 100) / 100;
  updateSheetPisCofinsValor();
  document.getElementById('sheetItemNF').classList.add('open');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeSheetItemNF() {
  document.getElementById('sheetItemNF').classList.remove('open');
  sheetItemNFRow = null;
}

function saveSheetItemNF() {
  if (!sheetItemNFRow) return;
  var tr = sheetItemNFRow;
  document.querySelectorAll('#sheetItemNF input, #sheetItemNF select, #sheetItemNF textarea').forEach(function (el) {
    var f = el.getAttribute('data-field');
    if (!f) return;
    var inp = tr.querySelector('input[data-field="' + f + '"]');
    if (inp) inp.value = el.value;
  });
  var qtd = parseFloat(document.getElementById('sheet_quantidade_comercial').value) || 0;
  var vUnit = parseFloat(document.getElementById('sheet_valor_unitario_comercial').value) || 0;
  var qtdInp = tr.querySelector('input[data-field="quantidade_comercial"]');
  var vUnitInp = tr.querySelector('input[data-field="valor_unitario_comercial"]');
  if (qtdInp) qtdInp.value = qtd;
  if (vUnitInp) vUnitInp.value = vUnit;
  var descInp = tr.querySelector('input[data-field="descricao"]');
  var codInp = tr.querySelector('input[data-field="codigo_produto"]');
  var ncmInp = tr.querySelector('input[data-field="codigo_ncm"]');
  var unInp = tr.querySelector('input[data-field="unidade_comercial"]');
  if (descInp) descInp.value = document.getElementById('sheet_descricao').value || '';
  if (codInp) codInp.value = document.getElementById('sheet_codigo_produto').value || '';
  if (ncmInp) ncmInp.value = (document.getElementById('sheet_codigo_ncm').value || '').replace(/\D/g, '').padStart(8, '0').slice(0, 8) || '00000000';
  if (unInp) unInp.value = document.getElementById('sheet_unidade_comercial').value || 'UN';
  tr.dataset.icmsSt = document.getElementById('sheet_icms_situacao_tributaria').value || '400';
  tr.dataset.icmsOrigem = document.getElementById('sheet_icms_origem').value || '0';
  tr.dataset.pisSt = document.getElementById('sheet_pis_situacao_tributaria').value || '07';
  tr.dataset.cofinsSt = document.getElementById('sheet_cofins_situacao_tributaria').value || '07';
  tr.dataset.cfop = document.getElementById('sheet_cfop').value || '5102';
  tr.dataset.tipo = document.getElementById('sheet_tipo').value || '';
  tr.dataset.pisAliquotaPorcentual = document.getElementById('sheet_pis_aliquota').value || '';
  tr.dataset.cofinsAliquotaPorcentual = document.getElementById('sheet_cofins_aliquota').value || '';
  tr.dataset.pisBaseCalculo = document.getElementById('sheet_pis_base').value || '';
  tr.dataset.cofinsBaseCalculo = document.getElementById('sheet_cofins_base').value || '';
  tr.dataset.pisValor = document.getElementById('sheet_pis_valor').value || '';
  tr.dataset.cofinsValor = document.getElementById('sheet_cofins_valor').value || '';
  tr.dataset.icmsModalidadeBaseCalculo = document.getElementById('sheet_icms_modalidade_bc').value || '';
  tr.dataset.icmsAliquota = document.getElementById('sheet_icms_aliquota').value || '';
  var icmsVal = parseFloat(document.getElementById('sheet_icms_valor').value);
  tr.dataset.icmsValor = !isNaN(icmsVal) ? String(Math.round(icmsVal * 100) / 100) : '';
  tr.dataset.ipiSt = document.getElementById('sheet_ipi_situacao_tributaria').value || '53';
  tr.dataset.ipiCodEnquadramento = document.getElementById('sheet_ipi_codigo_enquadramento').value || '';
  var ipiVal = parseFloat(document.getElementById('sheet_ipi_valor').value);
  tr.dataset.ipiValor = !isNaN(ipiVal) ? String(Math.round(ipiVal * 100) / 100) : '';
  var freteVal = parseFloat(document.getElementById('sheet_valor_frete').value);
  tr.dataset.valorFrete = !isNaN(freteVal) ? String(Math.round(freteVal * 100) / 100) : '0';
  updateValorBruto(tr);
  updateModalCalcTotais();
  closeSheetItemNF();
}

// ---------------------- Local destino e ICMS (auto por UF) ----------------------
var UF_ALIQUOTA_INTERESTADUAL_7 = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'ES', 'GO', 'MA', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'RN', 'RO', 'RR', 'SE', 'TO'];
var ICMS_ALIQUOTA_INTERNA = 18;

function getAliquotaInterestadualPorUF(ufDestino) {
  var uf = (ufDestino || '').trim().toUpperCase();
  if (!uf) return 12;
  return UF_ALIQUOTA_INTERESTADUAL_7.indexOf(uf) >= 0 ? 7 : 12;
}

function recalcIcmsItensByUFs() {
  var ufEmitente = (document.getElementById('nf_uf_emitente') && document.getElementById('nf_uf_emitente').value || '').trim().toUpperCase();
  var ufDestinatario = (document.getElementById('nf_uf_destinatario') && document.getElementById('nf_uf_destinatario').value || '').trim().toUpperCase();
  var paisDest = (document.getElementById('nf_pais_destinatario') && document.getElementById('nf_pais_destinatario').value || 'Brasil').trim();
  var isBrasil = /brasil/i.test(paisDest) || paisDest === '';
  var isInterestadual = isBrasil && ufEmitente.length === 2 && ufDestinatario.length === 2 && ufEmitente !== ufDestinatario;
  var aliquotaPadrao = !isBrasil ? 0 : isInterestadual ? getAliquotaInterestadualPorUF(ufDestinatario) : ICMS_ALIQUOTA_INTERNA;

  var tbody = document.getElementById('nfItemsBody');
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(function (tr) {
    var cst = (tr.dataset.icmsSt || '400').trim();
    if (cst !== '00') return;
    var totalEl = tr.querySelector('.valor-bruto-display');
    var qInp = tr.querySelector('input[data-field="quantidade_comercial"]');
    var vInp = tr.querySelector('input[data-field="valor_unitario_comercial"]');
    var base = 0;
    if (totalEl) {
      var txt = (totalEl.value || '').replace(/\./g, '').replace(',', '.');
      base = parseFloat(txt) || 0;
    } else if (qInp && vInp) {
      base = (parseFloat(qInp.value) || 0) * (parseFloat(vInp.value) || 0);
      base = Math.round(base * 100) / 100;
    }
    if (base <= 0) return;
    var aliquota = (tr.dataset.icmsAliquota !== undefined && tr.dataset.icmsAliquota !== '') ? parseFloat(tr.dataset.icmsAliquota) : aliquotaPadrao;
    var valorIcms = Math.round(base * aliquota * 100) / 10000;
    tr.dataset.icmsAliquota = String(aliquota);
    tr.dataset.icmsValor = String(valorIcms);
  });
  if (sheetItemNFRow) {
    var aliqEl = document.getElementById('sheet_icms_aliquota');
    var valEl = document.getElementById('sheet_icms_valor');
    if (aliqEl) aliqEl.value = sheetItemNFRow.dataset.icmsAliquota || '';
    if (valEl) valEl.value = sheetItemNFRow.dataset.icmsValor || '';
  }
  updateModalCalcTotais(true);
}

function updateLocalDestinoFromUFs() {
  var sel = document.getElementById('nf_local_destino');
  if (!sel) return;
  var ufEmitente = (document.getElementById('nf_uf_emitente') && document.getElementById('nf_uf_emitente').value || '').trim().toUpperCase();
  var ufDestinatario = (document.getElementById('nf_uf_destinatario') && document.getElementById('nf_uf_destinatario').value || '').trim().toUpperCase();
  var paisDest = (document.getElementById('nf_pais_destinatario') && document.getElementById('nf_pais_destinatario').value || 'Brasil').trim();
  var isBrasil = /brasil/i.test(paisDest) || paisDest === '';
  if (!isBrasil) {
    sel.value = '3';
    recalcIcmsItensByUFs();
    return;
  }
  if (ufEmitente.length === 2 && ufDestinatario.length === 2) {
    sel.value = ufEmitente === ufDestinatario ? '1' : '2';
  }
  recalcIcmsItensByUFs();
}

// ---------------------- Payload ----------------------
function cfopPorDestino(cfopBase, isInterestadual) {
  var base = String(cfopBase || '').trim();
  if (!base) return '5102';
  if (isInterestadual && base.charAt(0) === '5') return '6' + base.slice(1);
  if (!isInterestadual && base.charAt(0) === '6') return '5' + base.slice(1);
  return base;
}

function getPayloadFromForm() {
  var get = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
  var tipoPessoa = get('nf_tipo_pessoa_dest');
  var cpfCnpj = onlyNumbers(get('nf_cpf_cnpj_dest'));
  var ufEmitente = (get('nf_uf_emitente') || 'MG').trim().toUpperCase();
  var ufDestinatario = (get('nf_uf_destinatario') || '').trim().toUpperCase();
  var isInterestadual = ufEmitente.length === 2 && ufDestinatario.length === 2 && ufEmitente !== ufDestinatario;
  var localDestino = isInterestadual ? 2 : (ufEmitente && ufDestinatario ? 1 : (parseInt(get('nf_local_destino'), 10) || 1));
  var totalTribInput = parseFloat(get('nf_total_tributos'));
  var payload = {
    natureza_operacao: get('nf_natureza_operacao') || 'Venda de mercadoria',
    data_emissao: get('nf_data_emissao'),
    data_entrada_saida: get('nf_data_entrada_saida'),
    finalidade_emissao: get('nf_finalidade_emissao') || '1',
    tipo_documento: '1',
    consumidor_final: get('nf_consumidor_final') || '1',
    presenca_comprador: get('nf_presenca_comprador') || '2',
    local_destino: localDestino,
    indicador_inscricao_estadual_destinatario: (function () {
      var ind = parseInt(get('nf_indicador_ie_dest'), 10) || 9;
      if (ind === 2) ind = 9;
      return ind;
    })(),
    cnpj_emitente: onlyNumbers(get('nf_cnpj_emitente')),
    nome_emitente: get('nf_nome_emitente'),
    nome_fantasia_emitente: get('nf_nome_fantasia_emitente') || undefined,
    logradouro_emitente: get('nf_logradouro_emitente'),
    numero_emitente: get('nf_numero_emitente') || 'S/N',
    bairro_emitente: get('nf_bairro_emitente'),
    municipio_emitente: get('nf_municipio_emitente'),
    uf_emitente: get('nf_uf_emitente') || 'MG',
    cep_emitente: onlyNumbers(get('nf_cep_emitente')).padStart(8, '0').slice(0, 8) || '00000000',
    inscricao_estadual_emitente: get('nf_inscricao_estadual_emitente'),
    telefone_emitente: get('nf_telefone_emitente') || undefined,
    nome_destinatario: get('nf_nome_destinatario'),
    inscricao_estadual_destinatario: get('nf_inscricao_estadual_destinatario') || 'ISENTO',
    logradouro_destinatario: get('nf_logradouro_destinatario'),
    numero_destinatario: get('nf_numero_destinatario') || 'S/N',
    complemento_destinatario: get('nf_complemento_destinatario') || undefined,
    bairro_destinatario: get('nf_bairro_destinatario'),
    municipio_destinatario: get('nf_municipio_destinatario'),
    uf_destinatario: get('nf_uf_destinatario') || 'EX',
    pais_destinatario: get('nf_pais_destinatario') || 'Brasil',
    cep_destinatario: onlyNumbers(get('nf_cep_destinatario')).padStart(8, '0').slice(0, 8) || '00000000',
    valor_frete: parseFloat(get('nf_valor_frete')) || 0,
    valor_seguro: 0,
    valor_total: parseFloat(get('nf_valor_total')) || 0,
    valor_produtos: parseFloat(get('nf_valor_produtos')) || 0,
    valor_aproximado_tributos: !isNaN(totalTribInput) ? Math.round(totalTribInput * 100) / 100 : undefined,
    modalidade_frete: '0',
    items: []
  };
  if (tipoPessoa === 'pf' && cpfCnpj.length === 11) payload.cpf_destinatario = cpfCnpj;
  else if (tipoPessoa === 'pj' && cpfCnpj.length === 14) payload.cnpj_destinatario = cpfCnpj;
  var telDest = get('nf_telefone_destinatario');
  if (telDest) payload.telefone_destinatario = telDest;
  var desc = parseFloat(get('nf_valor_desconto'));
  if (desc > 0) payload.valor_desconto = desc;
  var infoContrib = get('nf_info_complementares');
  if (infoContrib) payload.informacoes_adicionais_contribuinte = infoContrib;
  var totalIs = parseFloat(get('nf_total_is'));
  var totalIbs = parseFloat(get('nf_total_ibs'));
  var totalCbs = parseFloat(get('nf_total_cbs'));
  if (!isNaN(totalIs) && totalIs > 0) payload.total_is = totalIs;
  if (!isNaN(totalIbs) && totalIbs > 0) payload.total_ibs = totalIbs;
  if (!isNaN(totalCbs) && totalCbs > 0) payload.total_cbs = totalCbs;
  var tbody = document.getElementById('nfItemsBody');
  tbody.querySelectorAll('tr').forEach(function (tr, idx) {
    var inputs = tr.querySelectorAll('input[data-field]');
    var baseCfop = tr.dataset.cfop || '5102';
    var item = {
      numero_item: String(idx + 1),
      codigo_produto: '',
      descricao: 'Item',
      cfop: cfopPorDestino(baseCfop, isInterestadual),
      unidade_comercial: 'UN',
      quantidade_comercial: 0,
      valor_unitario_comercial: 0,
      codigo_ncm: '00000000',
      valor_bruto: 0,
      icms_situacao_tributaria: tr.dataset.icmsSt || '400',
      icms_origem: tr.dataset.icmsOrigem || '0',
      pis_situacao_tributaria: tr.dataset.pisSt || '07',
      cofins_situacao_tributaria: tr.dataset.cofinsSt || '07'
    };
    if (tr.dataset.tipo) item.tipo = tr.dataset.tipo;
    if (tr.dataset.pisAliquotaPorcentual) item.pis_aliquota_porcentual = parseFloat(tr.dataset.pisAliquotaPorcentual) || 0;
    if (tr.dataset.cofinsAliquotaPorcentual) item.cofins_aliquota_porcentual = parseFloat(tr.dataset.cofinsAliquotaPorcentual) || 0;
    if (tr.dataset.pisBaseCalculo) item.pis_base_calculo = parseFloat(tr.dataset.pisBaseCalculo) || 0;
    if (tr.dataset.cofinsBaseCalculo) item.cofins_base_calculo = parseFloat(tr.dataset.cofinsBaseCalculo) || 0;
    if (tr.dataset.pisValor) item.pis_valor = parseFloat(tr.dataset.pisValor) || 0;
    if (tr.dataset.cofinsValor) item.cofins_valor = parseFloat(tr.dataset.cofinsValor) || 0;
    if (tr.dataset.icmsModalidadeBaseCalculo) item.icms_modalidade_base_calculo = tr.dataset.icmsModalidadeBaseCalculo;
    if (tr.dataset.icmsAliquota) item.icms_aliquota = parseFloat(tr.dataset.icmsAliquota) || 0;
    if (tr.dataset.icmsValor) item.icms_valor = Math.round((parseFloat(tr.dataset.icmsValor) || 0) * 100) / 100;
    if (tr.dataset.valorFrete != null && tr.dataset.valorFrete !== '') item.valor_frete = Math.round((parseFloat(tr.dataset.valorFrete) || 0) * 100) / 100;
    inputs.forEach(function (inp) {
      var f = inp.getAttribute('data-field');
      var v = inp.value.trim();
      var n = parseFloat(v);
      if (f === 'quantidade_comercial') item[f] = isNaN(n) ? 0 : n;
      else if (f === 'valor_unitario_comercial') item[f] = isNaN(n) ? 0 : Math.round(n * 100) / 100;
      else if (f === 'codigo_ncm') item[f] = onlyNumbers(v).padStart(8, '0').slice(0, 8) || '00000000';
      else if (v) item[f] = v;
    });
    item.valor_unitario_tributavel = item.valor_unitario_comercial;
    item.unidade_tributavel = item.unidade_comercial || 'UN';
    item.quantidade_tributavel = item.quantidade_comercial;
    item.valor_bruto = Math.round((item.quantidade_comercial || 0) * (item.valor_unitario_comercial || 0) * 100) / 100;
    item.cfop = tr.dataset.cfop || item.cfop || '5102';
    payload.items.push(item);
  });
  return payload;
}

// ---------------------- Endereço destinatário (cards / seleção) ----------------------
var nfEnderecosList = [];
var selectedNfEnderecoIndex = -1;

function getAddressFromForm() {
  return {
    rua: (document.getElementById('nf_logradouro_destinatario') && document.getElementById('nf_logradouro_destinatario').value) || '',
    numero: (document.getElementById('nf_numero_destinatario') && document.getElementById('nf_numero_destinatario').value) || '',
    bairro: (document.getElementById('nf_bairro_destinatario') && document.getElementById('nf_bairro_destinatario').value) || '',
    cidade: (document.getElementById('nf_municipio_destinatario') && document.getElementById('nf_municipio_destinatario').value) || '',
    uf: (document.getElementById('nf_uf_destinatario') && document.getElementById('nf_uf_destinatario').value) || '',
    cep: (document.getElementById('nf_cep_destinatario') && document.getElementById('nf_cep_destinatario').value) || '',
    complemento: (document.getElementById('nf_complemento_destinatario') && document.getElementById('nf_complemento_destinatario').value) || ''
  };
}

function fillAddressInForm(addr) {
  if (!addr) return;
  var set = function (id, v) { var el = document.getElementById(id); if (el) el.value = (v != null && v !== undefined) ? String(v) : ''; };
  set('nf_logradouro_destinatario', addr.rua);
  set('nf_numero_destinatario', addr.numero);
  set('nf_complemento_destinatario', addr.complemento);
  set('nf_bairro_destinatario', addr.bairro);
  set('nf_municipio_destinatario', addr.cidade);
  set('nf_uf_destinatario', addr.uf);
  set('nf_cep_destinatario', addr.cep);
  updateLocalDestinoFromUFs();
}

function addressHasData(addr) {
  return !!(addr && (addr.rua || addr.cep || addr.bairro || addr.cidade || addr.uf));
}

function buildNfEnderecosFromContact(contato) {
  if (!contato || typeof contato !== 'object') return [];
  var list = [];
  if (Array.isArray(contato.enderecos) && contato.enderecos.length > 0) {
    contato.enderecos.forEach(function (e) {
      if (!e || typeof e !== 'object') return;
      var rua = e.rua || e.logradouro || '';
      var cep = (e.cep != null ? String(e.cep).replace(/\D/g, '') : '') || '';
      if (!rua && !e.bairro && !cep) return;
      list.push({
        tipo: e.tipo || 'Endereço',
        rua: rua,
        numero: e.numero || '',
        bairro: e.bairro || '',
        cidade: e.cidade || e.municipio || '',
        uf: e.uf || e.estado || '',
        cep: cep,
        complemento: e.complemento || ''
      });
    });
    if (list.length > 0) return list;
  }
  var tipos = [
    { key: 'endereco_comercial', label: 'Comercial' },
    { key: 'endereco_residencial', label: 'Residencial' },
    { key: 'endereco_entrega', label: 'Entrega' },
    { key: 'endereco_nota_fiscal', label: 'Nota Fiscal' }
  ];
  tipos.forEach(function (t) {
    var e = contato[t.key];
    if (e && typeof e === 'object' && addressHasData(e)) {
      list.push({
        tipo: t.label,
        rua: e.rua || e.logradouro || '',
        numero: e.numero || '',
        bairro: e.bairro || '',
        cidade: e.cidade || e.municipio || '',
        uf: e.uf || e.estado || '',
        cep: (e.cep != null ? String(e.cep).replace(/\D/g, '') : '') || '',
        complemento: e.complemento || ''
      });
    }
  });
  if (list.length === 0 && (contato.logradouro || contato.cep || contato.bairro)) {
    list.push({
      tipo: 'Principal',
      rua: contato.logradouro || '',
      numero: contato.numero || '',
      bairro: contato.bairro || '',
      cidade: contato.municipio || contato.cidade || '',
      uf: contato.uf || contato.estado || '',
      cep: (contato.cep != null ? String(contato.cep).replace(/\D/g, '') : '') || '',
      complemento: ''
    });
  }
  return list;
}

function buildNfEnderecosFromForm() {
  var a = getAddressFromForm();
  if (!addressHasData(a)) return [];
  return [{ tipo: 'Destinatário', rua: a.rua, numero: a.numero, bairro: a.bairro, cidade: a.cidade, uf: a.uf, cep: a.cep, complemento: a.complemento || '' }];
}

function formatEnderecoCardLine(addr) {
  var parts = [];
  if (addr.rua && addr.numero) parts.push(addr.rua + ', ' + addr.numero);
  else if (addr.rua) parts.push(addr.rua);
  if (addr.bairro) parts.push(addr.bairro);
  if (addr.cep) parts.push('CEP ' + String(addr.cep).replace(/(\d{5})(\d{3})/, '$1-$2'));
  if (addr.cidade && addr.uf) parts.push(addr.cidade + ' - ' + addr.uf);
  else if (addr.cidade) parts.push(addr.cidade);
  if (addr.complemento) parts.push(addr.complemento);
  return parts;
}

function renderNfDestinatarioEnderecos() {
  var container = document.getElementById('nfDestinatarioEnderecosCards');
  var addBtn = document.getElementById('nfDestinatarioEnderecoAddBtn');
  if (!container) return;
  container.innerHTML = '';
  container.style.display = 'none';
  if (addBtn) addBtn.style.display = 'none';

  if (nfEnderecosList.length === 0) {
    if (addBtn) addBtn.style.display = 'inline-flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  if (nfEnderecosList.length === 1) {
    selectedNfEnderecoIndex = 0;
    fillAddressInForm(nfEnderecosList[0]);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  container.style.display = 'grid';
  if (selectedNfEnderecoIndex < 0 || selectedNfEnderecoIndex >= nfEnderecosList.length) selectedNfEnderecoIndex = 0;
  fillAddressInForm(nfEnderecosList[selectedNfEnderecoIndex]);

  nfEnderecosList.forEach(function (addr, idx) {
    var card = document.createElement('div');
    card.className = 'nf-endereco-card' + (idx === selectedNfEnderecoIndex ? ' selected' : '');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('data-index', String(idx));
    var lines = formatEnderecoCardLine(addr);
    lines.forEach(function (line) {
      var div = document.createElement('div');
      div.className = 'nf-endereco-card-line';
      div.textContent = line;
      card.appendChild(div);
    });
    card.addEventListener('click', function () {
      selectedNfEnderecoIndex = idx;
      fillAddressInForm(nfEnderecosList[idx]);
      container.querySelectorAll('.nf-endereco-card').forEach(function (c) { c.classList.remove('selected'); });
      card.classList.add('selected');
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
    container.appendChild(card);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function fetchNfEnderecosAndRender(contatoId) {
  if (!contatoId) {
    nfEnderecosList = buildNfEnderecosFromForm();
    renderNfDestinatarioEnderecos();
    return;
  }
  fetch(API + '/fiscal/contatos/' + contatoId)
    .then(function (r) { return r.json(); })
    .then(function (contato) {
      nfEnderecosList = buildNfEnderecosFromContact(contato);
      if (nfEnderecosList.length === 0) nfEnderecosList = buildNfEnderecosFromForm();
      selectedNfEnderecoIndex = nfEnderecosList.length > 0 ? 0 : -1;
      renderNfDestinatarioEnderecos();
    })
    .catch(function () {
      nfEnderecosList = buildNfEnderecosFromForm();
      renderNfDestinatarioEnderecos();
    });
}

// ---------------------- Fill form from payload ----------------------
function fillFormFromPayload(p) {
  if (!p) return;
  var set = function (id, val) { var el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = String(val); };
  var setNum = function (id, val) { var el = document.getElementById(id); if (el) el.value = val !== undefined && val !== null && !isNaN(Number(val)) ? String(Number(val)) : ''; };
  var setSel = function (id, val) { var el = document.getElementById(id); if (el) el.value = val !== undefined && val !== null ? String(val) : ''; };
  var toDatetimeLocal = function (v) {
    if (!v || typeof v !== 'string') return '';
    var s = v.replace(/\.\d{3}Z?$/, '').slice(0, 19);
    return s.length >= 16 ? s : '';
  };
  set('nf_natureza_operacao', p.natureza_operacao);
  var dtEmissao = toDatetimeLocal(p.data_emissao);
  var dtEntradaSaida = toDatetimeLocal(p.data_entrada_saida);
  if (fpDataEmissao) { if (dtEmissao) fpDataEmissao.setDate(dtEmissao); else fpDataEmissao.clear(); }
  else set('nf_data_emissao', dtEmissao);
  if (fpDataEntradaSaida) { if (dtEntradaSaida) fpDataEntradaSaida.setDate(dtEntradaSaida); else fpDataEntradaSaida.clear(); }
  else set('nf_data_entrada_saida', dtEntradaSaida);
  set('nf_finalidade_emissao', p.finalidade_emissao);
  setSel('nf_consumidor_final', p.consumidor_final);
  setSel('nf_presenca_comprador', p.presenca_comprador);
  setSel('nf_local_destino', p.local_destino);
  setSel('nf_indicador_ie_dest', (p.indicador_inscricao_estadual_destinatario === 2 ? 9 : p.indicador_inscricao_estadual_destinatario));
  set('nf_cnpj_emitente', p.cnpj_emitente);
  set('nf_nome_emitente', p.nome_emitente);
  set('nf_nome_fantasia_emitente', p.nome_fantasia_emitente);
  set('nf_inscricao_estadual_emitente', p.inscricao_estadual_emitente);
  set('nf_logradouro_emitente', p.logradouro_emitente);
  set('nf_numero_emitente', p.numero_emitente);
  set('nf_bairro_emitente', p.bairro_emitente);
  set('nf_municipio_emitente', p.municipio_emitente);
  set('nf_uf_emitente', p.uf_emitente);
  set('nf_cep_emitente', p.cep_emitente);
  set('nf_telefone_emitente', p.telefone_emitente);
  set('nf_nome_destinatario', p.nome_destinatario);
  setClienteUI(p.nome_destinatario || '', selectedContatoId);
  var cpfCnpj = (p.cpf_destinatario || p.cnpj_destinatario || '').toString().replace(/\D/g, '');
  var tipoSel = document.getElementById('nf_tipo_pessoa_dest');
  var docInp = document.getElementById('nf_cpf_cnpj_dest');
  if (tipoSel && docInp) {
    tipoSel.value = cpfCnpj.length === 11 ? 'pf' : cpfCnpj.length === 14 ? 'pj' : '';
    docInp.value = cpfCnpj.length === 11 ? maskCPF(cpfCnpj) : cpfCnpj.length === 14 ? maskCNPJ(cpfCnpj) : cpfCnpj;
    updateDocDestUI();
  }
  set('nf_inscricao_estadual_destinatario', p.inscricao_estadual_destinatario);
  set('nf_telefone_destinatario', p.telefone_destinatario);
  set('nf_logradouro_destinatario', p.logradouro_destinatario);
  set('nf_numero_destinatario', p.numero_destinatario);
  set('nf_complemento_destinatario', p.complemento_destinatario);
  set('nf_bairro_destinatario', p.bairro_destinatario);
  set('nf_municipio_destinatario', p.municipio_destinatario);
  set('nf_uf_destinatario', p.uf_destinatario);
  set('nf_pais_destinatario', p.pais_destinatario);
  set('nf_cep_destinatario', p.cep_destinatario);
  setNum('nf_valor_produtos', p.valor_produtos);
  setNum('nf_valor_frete', p.valor_frete);
  setNum('nf_valor_desconto', p.valor_desconto);
  setNum('nf_valor_total', p.valor_total);
  setNum('nf_total_produtos', p.valor_produtos);
  setNum('nf_valor_frete_calc', p.valor_frete);
  setNum('nf_valor_seguro_calc', p.valor_seguro);
  setNum('nf_outras_despesas', 0);
  setNum('nf_desconto_calc', p.valor_desconto);
  setNum('nf_total_nota', p.valor_total);
  setNum('nf_base_icms', p.base_icms);
  setNum('nf_valor_icms', p.valor_icms);
  setNum('nf_base_icms_st', p.base_icms_st);
  setNum('nf_valor_icms_st', p.valor_icms_st);
  setNum('nf_valor_ipi', p.valor_ipi);
  setNum('nf_total_is', p.total_is);
  setNum('nf_total_ibs', p.total_ibs);
  setNum('nf_total_cbs', p.total_cbs);
  setNum('nf_total_tributos', p.valor_aproximado_tributos);
  var infoContrib = (p.informacoes_adicionais_contribuinte != null ? String(p.informacoes_adicionais_contribuinte) : '').trim();
  set('nf_info_complementares', infoContrib);
  var tbody = document.getElementById('nfItemsBody');
  if (tbody) tbody.innerHTML = '';
  (p.items || p.itens || []).forEach(function (item, idx) { addItemRow(item, idx + 1); });
  updateModalCalcTotais();
  nfEnderecosList = buildNfEnderecosFromForm();
  renderNfDestinatarioEnderecos();
  updateLocalDestinoFromUFs();
}

// ---------------------- Cliente sheet (mínimo para plus/pen) ----------------------
var clienteEnderecos = { comercial: {}, residencial: {}, entrega: {}, nota_fiscal: {} };

function formatEnderecoDisplay(obj) {
  if (!obj || (!obj.rua && !obj.cep)) return null;
  var parts = [];
  if (obj.rua && obj.numero) parts.push(obj.rua + ', ' + obj.numero);
  else if (obj.rua) parts.push(obj.rua);
  if (obj.bairro && obj.cep) parts.push(obj.bairro + ' - ' + obj.cep);
  else if (obj.bairro) parts.push(obj.bairro);
  else if (obj.cep) parts.push(obj.cep);
  if (obj.cidade && obj.uf) parts.push(obj.cidade + ' - ' + obj.uf);
  return parts.length ? parts.join('\\n') : null;
}

function showClienteView(view) {
  var formView = document.getElementById('sheetClienteViewForm');
  var endView = document.getElementById('sheetClienteViewEndereco');
  var footerForm = document.getElementById('sheetClienteFooterForm');
  var footerEnd = document.getElementById('sheetClienteFooterEndereco');
  if (view === 'endereco') {
    formView.classList.remove('active');
    endView.classList.add('active');
    footerForm.style.display = 'none';
    footerEnd.style.display = 'flex';
  } else {
    endView.classList.remove('active');
    formView.classList.add('active');
    footerEnd.style.display = 'none';
    footerForm.style.display = 'flex';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openModalCliente(cliente) {
  cliente = cliente || {};
  document.getElementById('cliente_nome_fantasia').value = cliente.nome_fantasia || '';
  document.getElementById('cliente_tipo_pessoa').value = cliente.tipo_pessoa || 'pj';
  document.getElementById('cliente_cnpj').value = cliente.cnpj || '';
  document.getElementById('cliente_razao_social').value = cliente.razao_social || '';
  document.getElementById('cliente_tipo_contribuinte').value = cliente.tipo_contribuinte || '9';
  document.getElementById('cliente_inscricao_estadual').value = cliente.inscricao_estadual || '';
  document.getElementById('cliente_email').value = cliente.email || '';
  document.getElementById('cliente_telefone_celular').value = cliente.telefone_celular || '';
  document.getElementById('cliente_telefone_comercial').value = cliente.telefone_comercial || '';
  clienteEnderecos = {
    comercial: cliente.endereco_comercial || {},
    residencial: cliente.endereco_residencial || {},
    entrega: cliente.endereco_entrega || {},
    nota_fiscal: cliente.endereco_nota_fiscal || {}
  };
  var tipos = ['comercial', 'residencial', 'entrega', 'nota_fiscal'];
  var labels = { comercial: 'Comercial', residencial: 'Residencial', entrega: 'Entrega', nota_fiscal: 'NotaFiscal' };
  tipos.forEach(function (t) {
    var disp = document.getElementById('clienteEndereco' + labels[t] + 'Display');
    var card = document.querySelector('.cliente-endereco-card[data-tipo="' + t + '"]');
    if (disp) {
      var txt = formatEnderecoDisplay(clienteEnderecos[t]);
      disp.textContent = txt || 'Clique em editar para preencher o endereço';
      disp.classList.toggle('empty', !txt);
    }
    if (card) {
      var temEndereco = !!formatEnderecoDisplay(clienteEnderecos[t]);
      card.style.display = temEndereco ? '' : 'none';
    }
  });
  var addCard = document.getElementById('clienteEnderecoCardAdd');
  if (addCard) addCard.style.display = 'flex';
  document.getElementById('sheetClienteTitle').textContent = cliente.id ? 'Editar cliente' : 'Novo cliente';
  showClienteView('form');
  document.getElementById('sheetCliente').classList.add('open');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openModalClienteEndereco(tipo) {
  var end = clienteEnderecos[tipo] || {};
  document.getElementById('cliente_endereco_tipo').value = tipo;
  document.getElementById('cliente_end_tipo').value = tipo;
  document.getElementById('cliente_end_cep').value = end.cep || '';
  document.getElementById('cliente_end_rua').value = end.rua || '';
  document.getElementById('cliente_end_numero').value = end.numero || '';
  document.getElementById('cliente_end_complemento').value = end.complemento || '';
  document.getElementById('cliente_end_bairro').value = end.bairro || '';
  document.getElementById('cliente_end_cidade').value = end.cidade || '';
  document.getElementById('cliente_end_uf').value = end.uf || '';
  showClienteView('endereco');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function saveClienteEndereco() {
  var tipo = document.getElementById('cliente_endereco_tipo').value;
  clienteEnderecos[tipo] = {
    cep: document.getElementById('cliente_end_cep').value.trim(),
    rua: document.getElementById('cliente_end_rua').value.trim(),
    numero: document.getElementById('cliente_end_numero').value.trim(),
    complemento: document.getElementById('cliente_end_complemento').value.trim(),
    bairro: document.getElementById('cliente_end_bairro').value.trim(),
    cidade: document.getElementById('cliente_end_cidade').value.trim(),
    uf: document.getElementById('cliente_end_uf').value
  };
  var labels = { comercial: 'Comercial', residencial: 'Residencial', entrega: 'Entrega', nota_fiscal: 'NotaFiscal' };
  var disp = document.getElementById('clienteEndereco' + (labels[tipo] || tipo) + 'Display');
  var txt = formatEnderecoDisplay(clienteEnderecos[tipo]);
  if (disp) {
    disp.textContent = txt || 'Clique em editar para preencher o endereço';
    disp.classList.toggle('empty', !txt);
  }
  var card = document.querySelector('.cliente-endereco-card[data-tipo="' + tipo + '"]');
  if (card && txt) card.style.display = '';
  showClienteView('form');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ---------------------- Carregar empresas/naturezas ----------------------
async function loadEmpresas() {
  const sel = document.getElementById('empresaId');
  if (!sel) return;
  try {
    const res = await fetch(API + '/fiscal/empresas');
    const data = await res.json();
    if (!res.ok) {
      const msg = (data && (data.detail || data.message)) || res.status;
      sel.innerHTML = '<option value="">Erro: ' + msg + '</option>';
      return;
    }
    const list = Array.isArray(data) ? data : [];
    sel.innerHTML = '<option value="">Selecionar</option>' +
      list.map(function (e) { return '<option value="' + e.id + '">' + (e.razao_social || '') + '</option>'; }).join('');
  } catch (e) {
    sel.innerHTML = '<option value="">Erro de rede</option>';
  }
  // Quando trocar empresa, recarregar naturezas filtradas
  sel.addEventListener('change', function () {
    var empId = parseInt(sel.value || '0', 10) || 0;
    loadNaturezas(empId > 0 ? empId : undefined);
  });
}

async function loadNaturezas(empresaId) {
  const sel = document.getElementById('naturezaId');
  if (!sel) return;
  try {
    var url = API + '/fiscal/naturezas';
    if (empresaId != null && empresaId > 0) url += '?empresa_id=' + empresaId;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      const msg = (data && (data.detail || data.message)) || res.status;
      sel.innerHTML = '<option value="">Erro: ' + msg + '</option>';
      return;
    }
    const list = Array.isArray(data) ? data : [];
    sel.innerHTML = '<option value="">Selecionar</option>' +
      list.map(function (n) { return '<option value="' + n.id + '">' + stripIdSuffix(n.descricao) + '</option>'; }).join('');
  } catch (e) {
    sel.innerHTML = '<option value="">Erro de rede</option>';
  }
}

// ---------------------- Init page ----------------------
async function loadByInvoiceId(invoiceId) {
  setPageMessage('Carregando…', 'info');
  try {
    const res = await fetch(API + '/fiscal/' + invoiceId + '/editar');
    const d = await res.json();
    if (!res.ok || (d && d.message && Object.keys(d).length === 1)) {
      setPageMessage(d && d.message ? d.message : 'Não foi possível carregar os dados da nota.', 'error');
      return;
    }
    modalNFContext = {
      pedidoId: d.pedido_id || 0,
      empresaId: d.empresa_id || 0,
      naturezaId: d.natureza_operacao_id || 0
    };
    var pedidoInp = document.getElementById('pedidoId');
    var empSel = document.getElementById('empresaId');
    var natSel = document.getElementById('naturezaId');
    if (pedidoInp) pedidoInp.value = modalNFContext.pedidoId || '';
    if (empSel) empSel.value = modalNFContext.empresaId || '';
    if (natSel) natSel.value = modalNFContext.naturezaId || '';
    fillFormFromPayload(d.payload);
    await resolveClienteFromPedido(modalNFContext.pedidoId);
    fetchNfEnderecosAndRender(selectedContatoId);
    setPageMessage('', 'info');
    var help = document.getElementById('nfModeHelp');
    if (help) help.textContent = 'Modo edição (invoiceId: ' + invoiceId + ').';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {
    setPageMessage('Erro: ' + (e.message || 'ao carregar'), 'error');
  }
}

async function loadPreviewFromContext() {
  var pedidoId = parseInt(document.getElementById('pedidoId').value.trim() || '0', 10) || 0;
  var empresaId = parseInt(document.getElementById('empresaId').value.trim() || '0', 10) || 0;
  var naturezaId = parseInt(document.getElementById('naturezaId').value.trim() || '0', 10) || 0;
  if (!pedidoId || pedidoId < 1) { setPageMessage('Informe um ID de pedido válido.', 'error'); return; }
  if (!empresaId || empresaId < 1) { setPageMessage('Selecione a empresa.', 'error'); return; }
  if (!naturezaId || naturezaId < 1) { setPageMessage('Selecione a natureza de operação.', 'error'); return; }
  modalNFContext = { pedidoId: pedidoId, empresaId: empresaId, naturezaId: naturezaId };
  setPageMessage('Carregando…', 'info');
  await resolveClienteFromPedido(pedidoId);
  try {
    var r = await fetch(API + '/fiscal/preview-chamada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedidoId: pedidoId, empresa_id: empresaId, natureza_operacao_id: naturezaId })
    });
    var text = await r.text();
    var data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      setPageMessage('Resposta inválida do servidor (não é JSON): ' + (text.slice(0, 150) || r.status), 'error');
      return;
    }
    if (r.ok && data && (Array.isArray(data.items) || Array.isArray(data.itens))) {
      fillFormFromPayload(data);
      fetchNfEnderecosAndRender(selectedContatoId);
      setPageMessage('', 'info');
      var help = document.getElementById('nfModeHelp');
      if (help) help.textContent = 'Modo criação (pedidoId: ' + pedidoId + ').';
      validarTributacaoFromContext();

    } else {
      var errMsg = null;
      if (data) {
        errMsg = data.detail || (typeof data.message === 'string' ? data.message : null);
        if (!errMsg && data.message && typeof data.message === 'object')
          errMsg = data.message.detail || data.message.message || (Array.isArray(data.message) ? data.message[0] : null);
        if (!errMsg && Array.isArray(data.message) && data.message.length > 0)
          errMsg = String(data.message[0]);
      }
      errMsg = errMsg || 'Não foi possível carregar os dados da nota.';
      setPageMessage(errMsg, 'error');
      if (console && console.warn) console.warn('preview-chamada error:', r.status, errMsg, data);
    }
  } catch (e) {
    setPageMessage('Erro: ' + (e.message || 'ao carregar'), 'error');
  }
}

// ---------------------- Validação tributária ----------------------
async function validarTributacaoFromContext() {
  var pedidoId = parseInt(document.getElementById('pedidoId').value.trim() || '0', 10) || 0;
  var empresaId = parseInt(document.getElementById('empresaId').value.trim() || '0', 10) || 0;
  var naturezaId = parseInt(document.getElementById('naturezaId').value.trim() || '0', 10) || 0;
  if (!pedidoId || !empresaId || !naturezaId) return;
  try {
    var res = await fetch(API + '/fiscal/validar-tributacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedidoId, empresa_id: empresaId, natureza_operacao_id: naturezaId })
    });
    var data = await res.json();
    if (res.ok && data && data.regras_aplicadas) {
      console.info('[Tributação Validada]', data);
      window._tributacaoValidada = data;
    } else {
      console.warn('[Tributação] Falha:', data && (data.message || data.detail));
    }
  } catch (e) {
    console.warn('[Tributação] Erro de rede:', e.message);
  }
}



function showModalAlertaContribuinte(message) {
  var overlay = document.getElementById('modalAlertaContribuinte');
  var msgEl = document.getElementById('modalAlertaContribuinteMessage');
  if (msgEl) msgEl.textContent = message || 'Inconsistência nos dados fiscais do destinatário.';
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.classList.add('open');
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeModalAlertaContribuinte() {
  var overlay = document.getElementById('modalAlertaContribuinte');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.classList.remove('open');
  }
}

async function emitFromForm() {
  var docValidation = validateDocDest();
  if (!docValidation.valid) {
    setDocDestError(docValidation.error);
    setFormMessage(docValidation.error || 'Verifique o documento do destinatário.', 'error');
    return;
  }
  clearDocDestError();
  var empresaId = parseInt(document.getElementById('empresaId').value.trim() || '0', 10) || 0;
  var naturezaId = parseInt(document.getElementById('naturezaId').value.trim() || '0', 10) || 0;
  var pedidoId = modalNFContext && modalNFContext.pedidoId ? modalNFContext.pedidoId : parseInt(document.getElementById('pedidoId').value.trim() || '0', 10) || 0;
  if (!empresaId || empresaId < 1) {
    setFormMessage('Selecione a empresa (remetente da nota).', 'error');
    return;
  }
  if (!naturezaId || naturezaId < 1) {
    setFormMessage('Selecione a natureza de operação.', 'error');
    return;
  }
  if (!pedidoId || pedidoId < 1) {
    setFormMessage('Informe o ID do pedido.', 'error');
    return;
  }
  modalNFContext = { pedidoId: pedidoId, empresaId: empresaId, naturezaId: naturezaId };
  var nomeDestEl = document.getElementById('nf_nome_destinatario');
  if ((!nomeDestEl || !nomeDestEl.value.trim()) && pedidoId) {
    await resolveClienteFromPedido(pedidoId);
  }
  nomeDestEl = document.getElementById('nf_nome_destinatario');
  if (!nomeDestEl || !nomeDestEl.value.trim()) {
    setFormMessage('Não foi possível resolver o cliente do pedido. Verifique o pedido_id e o contato vinculado.', 'error');
    return;
  }
  var payload = getPayloadFromForm();
  if (!payload.items || payload.items.length === 0) {
    setFormMessage('Adicione ao menos um produto.', 'error');
    return;
  }
  var indIE = payload.indicador_inscricao_estadual_destinatario;
  var ieDest = (payload.inscricao_estadual_destinatario || '').toString().trim();
  if (indIE === 1 && (!ieDest || ieDest.toUpperCase() === 'ISENTO')) {
    showModalAlertaContribuinte(
      'O destinatário está marcado como Contribuinte ICMS (indIEDest=1), mas a Inscrição Estadual está vazia ou é "ISENTO". ' +
      'Corrija o cadastro do cliente com a IE válida ou altere o indicador para "Não contribuinte" (9).'
    );
    return;
  }
  var btn = document.getElementById('btnEmitirNF');
  setFormMessage('');
  if (btn) { btn.disabled = true; btn.textContent = 'Emitindo…'; }
  try {
    var res = await fetch(API + '/fiscal/emitir-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pedido_id: pedidoId,
        empresa_id: empresaId,
        natureza_operacao_id: naturezaId,
        payload: payload
      })
    });
    var data = await res.json();
    if (!res.ok) {
      setFormMessage(data.message || data.detail || 'Erro ao emitir.', 'error');
      return;
    }
    setFormMessage(
      data.mensagem + (data.invoiceId ? ' Invoice: ' + data.invoiceId : '') + (data.focus_id ? ' | Ref: ' + data.focus_id : ''),
      'success'
    );
    setTimeout(function () { window.location.href = window.location.origin + '/painel/'; }, 1200);
  } catch (e) {
    setFormMessage('Erro de rede: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
  }
}

function applyCalcAutoInputsState() {
  var toggle = document.getElementById('nfCalcAutoToggle');
  var container = document.getElementById('calcImpostoInputs');
  if (!toggle || !container) return;
  var isOn = toggle.classList.contains('on');
  container.querySelectorAll('input').forEach(function (inp) {
    inp.readOnly = isOn;
    inp.classList.toggle('calc-auto-readonly', isOn);
  });
}

function initBindings() {
  var backBtn = document.getElementById('btnVoltarPainel');
  if (backBtn) backBtn.addEventListener('click', function () { window.location.href = window.location.origin + '/painel/'; });

  var btnCarregar = document.getElementById('btnCarregarDadosNF');
  if (btnCarregar) btnCarregar.addEventListener('click', loadPreviewFromContext);

  var naturezaSel = document.getElementById('naturezaId');
  if (naturezaSel) {
    naturezaSel.addEventListener('change', function () {
      var id = parseInt(naturezaSel.value.trim() || '0', 10);
      if (!id) return;
      fetch(API + '/fiscal/naturezas/' + id)
        .then(function (r) { return r.json(); })
        .then(function (nat) {
          if (!nat || nat.message) return;
          var info = (nat.infoAdicionais != null ? String(nat.infoAdicionais) : (nat.info_adicionais != null ? String(nat.info_adicionais) : '')).trim();
          var elInfo = document.getElementById('nf_info_complementares');
          if (elInfo) {
            var current = String(elInfo.value || '');
            var marker = 'Total aproximado de tributos';
            var idx = current.indexOf(marker);
            var ibptPart = idx >= 0 ? current.slice(idx).trimStart() : '';
            elInfo.value = info ? (ibptPart ? info + '\n\n' + ibptPart : info) : ibptPart;
          }
          updateModalCalcTotais(true);
        })
        .catch(function () { });
    });
  }

  document.getElementById('btnEmitirNF').addEventListener('click', emitFromForm);
  document.getElementById('btnAdicionarItemNF').addEventListener('click', function () { addItemRow({}, null); });
  var btnGerarParcelas = document.getElementById('btnGerarParcelas');
  if (btnGerarParcelas) btnGerarParcelas.addEventListener('click', function () { setFormMessage('Gerar parcelas: em desenvolvimento.', 'info'); });

  document.getElementById('nf_cep_emitente').addEventListener('blur', function () {
    buscaCep('nf_cep_emitente', 'nf_logradouro_emitente', 'nf_bairro_emitente', 'nf_municipio_emitente', 'nf_uf_emitente');
  });
  document.getElementById('nf_cep_destinatario').addEventListener('blur', function () {
    buscaCep('nf_cep_destinatario', 'nf_logradouro_destinatario', 'nf_bairro_destinatario', 'nf_municipio_destinatario', 'nf_uf_destinatario');
    updateLocalDestinoFromUFs();
  });
  (function initLocalDestinoFromUFs() {
    var ids = ['nf_uf_emitente', 'nf_uf_destinatario', 'nf_pais_destinatario'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateLocalDestinoFromUFs);
        el.addEventListener('change', updateLocalDestinoFromUFs);
      }
    });
  })();

  (function initDocDestinatario() {
    var tipoSel = document.getElementById('nf_tipo_pessoa_dest');
    var docInp = document.getElementById('nf_cpf_cnpj_dest');
    if (!tipoSel || !docInp) return;
    tipoSel.addEventListener('change', function () {
      docInp.value = '';
      updateDocDestUI();
    });
    docInp.addEventListener('input', function () {
      var tipo = tipoSel.value;
      if (tipo === 'pf') docInp.value = maskCPF(docInp.value);
      else if (tipo === 'pj') docInp.value = maskCNPJ(docInp.value);
      else docInp.value = onlyNumbers(docInp.value).slice(0, 14);
      clearDocDestError();
    });
    docInp.addEventListener('blur', function () {
      var r = validateDocDest();
      if (!r.valid && r.error) setDocDestError(r.error);
    });
  })();

  (function initClienteField() {
    var inputEl = document.getElementById('nf_cliente_busca');
    var listEl = document.getElementById('nf_cliente_contatos_list');
    var btnEl = document.getElementById('nf_cliente_btn_add_edit');
    if (!inputEl || !listEl || !btnEl) return;
    inputEl.setAttribute('readonly', 'readonly');
    function hideList() { listEl.innerHTML = ''; listEl.style.display = 'none'; }
    hideList();
    inputEl.addEventListener('focus', hideList);
    inputEl.addEventListener('keydown', function (e) {
      var allow = ['Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (allow.indexOf(e.key) !== -1) return;
      e.preventDefault();
    });
    inputEl.addEventListener('paste', function (e) { e.preventDefault(); });

    btnEl.addEventListener('click', function () {
      if (selectedContatoId) {
        fetch(API + '/fiscal/contatos/' + selectedContatoId)
          .then(function (r) { return r.json(); })
          .then(function (c) {
            if (c && typeof c === 'object') {
              var cliente = {
                id: c.contato_id || c.id,
                nome_fantasia: c.nome_fantasia || c.nome,
                razao_social: c.razao_social || c.nome,
                cnpj: (c.cpf_cnpj || '').toString().replace(/\D/g, ''),
                tipo_pessoa: (c.cpf_cnpj || '').toString().replace(/\D/g, '').length === 14 ? 'pj' : 'pf',
                inscricao_estadual: c.ie,
                email: c.email,
                telefone_celular: c.celular,
                telefone_comercial: c.telefoneFixo,
                endereco_entrega: c.logradouro || c.cep ? { rua: c.logradouro, numero: c.numero, bairro: c.bairro, cidade: c.municipio, uf: c.uf, cep: (c.cep || '').toString().replace(/\D/g, '') } : {}
              };
              openModalCliente(cliente);
            }
          })
          .catch(function () { });
      } else {
        openModalCliente();
      }
    });
  })();

  // Transporte / Transportadora
  (function initTransporteSection() {
    var selectTransporte = document.getElementById('nf_transporte');
    var dadosWrap = document.getElementById('nfTransportadorDados');
    var nomeEl = document.getElementById('nf_transp_nome');
    var docEl = document.getElementById('nf_transp_cnpj_cpf');
    var listEl = document.getElementById('nfTranspAcList');
    if (!selectTransporte || !dadosWrap) return;

    function setTransporteMode(mode) {
      var disable = mode === 'nao';
      dadosWrap.querySelectorAll('input, select, textarea').forEach(function (el) {
        el.disabled = disable;
        if (disable) el.value = '';
      });
      // Quando não haverá transporte, força "Sem frete"
      var freteConta = document.getElementById('nf_frete_por_conta');
      if (freteConta && disable) freteConta.value = '9';
    }

    selectTransporte.addEventListener('change', function () {
      setTransporteMode(this.value || 'nao');
    });
    setTransporteMode(selectTransporte.value || 'nao');

    // Campo Nome com autocomplete de transportadora (tipo_cadastro = 'transportadora') quando modo = "manual"
    if (nomeEl && listEl) {
      var searchTimeout;
      function hideList() {
        listEl.innerHTML = '';
        listEl.style.display = 'none';
      }
      function showList(items) {
        listEl.innerHTML = '';
        items.forEach(function (t) {
          var li = document.createElement('li');
          var label = t.nome || t.nome_fantasia || t.razao_social || '';
          if (t.cpf_cnpj) label += ' (' + t.cpf_cnpj + ')';
          li.textContent = label;
          li.dataset.nome = t.nome || t.nome_fantasia || t.razao_social || '';
          li.dataset.doc = t.cpf_cnpj || '';
          li.addEventListener('click', function () {
            nomeEl.value = li.dataset.nome || '';
            if (docEl && li.dataset.doc) docEl.value = li.dataset.doc;
            hideList();
          });
          listEl.appendChild(li);
        });
        listEl.style.display = items.length ? 'block' : 'none';
      }
      function runSearch() {
        if (selectTransporte.value !== 'manual') { hideList(); return; }
        var q = (nomeEl.value || '').trim();
        if (q.length < 2) { hideList(); return; }
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function () {
          fetch(API + '/fiscal/transportadoras?busca=' + encodeURIComponent(q))
            .then(function (r) { return r.json(); })
            .then(function (list) {
              if (!Array.isArray(list)) { hideList(); return; }
              showList(list);
            })
            .catch(function () { hideList(); });
        }, 300);
      }
      nomeEl.addEventListener('input', runSearch);
      nomeEl.addEventListener('focus', runSearch);
      nomeEl.addEventListener('blur', function () {
        setTimeout(hideList, 200);
      });
    }
  })();

  // Sheet item bindings
  document.getElementById('sheetItemNFClose').addEventListener('click', closeSheetItemNF);
  document.getElementById('sheetItemNFCancel').addEventListener('click', closeSheetItemNF);
  document.getElementById('sheetItemNFSave').addEventListener('click', saveSheetItemNF);
  document.getElementById('sheetItemNF').addEventListener('click', function (e) { if (e.target === this) closeSheetItemNF(); });
  document.querySelectorAll('#sheetTabs .sheet-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var t = this.getAttribute('data-tab');
      document.querySelectorAll('#sheetTabs .sheet-tab').forEach(function (x) { x.classList.remove('active'); });
      document.querySelectorAll('.sheet-tab-content').forEach(function (x) { x.classList.remove('active'); });
      this.classList.add('active');
      var content = document.getElementById('sheetTab' + t.charAt(0).toUpperCase() + t.slice(1));
      if (content) content.classList.add('active');
    });
  });
  document.getElementById('sheet_quantidade_comercial').addEventListener('input', function () {
    var q = parseFloat(this.value) || 0;
    var v = parseFloat(document.getElementById('sheet_valor_unitario_comercial').value) || 0;
    document.getElementById('sheet_valor_bruto').value = Math.round(q * v * 100) / 100;
    updateSheetPisCofinsValor();
  });
  document.getElementById('sheet_valor_unitario_comercial').addEventListener('input', function () {
    var q = parseFloat(document.getElementById('sheet_quantidade_comercial').value) || 0;
    var v = parseFloat(this.value) || 0;
    document.getElementById('sheet_valor_bruto').value = Math.round(q * v * 100) / 100;
    updateSheetPisCofinsValor();
  });
  document.getElementById('sheet_pis_base').addEventListener('input', updateSheetPisCofinsValor);
  document.getElementById('sheet_pis_aliquota').addEventListener('input', updateSheetPisCofinsValor);
  document.getElementById('sheet_cofins_base').addEventListener('input', updateSheetPisCofinsValor);
  document.getElementById('sheet_cofins_aliquota').addEventListener('input', updateSheetPisCofinsValor);
  document.getElementById('sheet_icms_valor').addEventListener('blur', function () {
    var v = parseFloat(this.value);
    if (!isNaN(v)) this.value = Math.round(v * 100) / 100;
  });

  function closeSheetCliente() {
    document.getElementById('sheetCliente').classList.remove('open');
    fetchNfEnderecosAndRender(selectedContatoId);
  }
  document.getElementById('sheetClienteClose').addEventListener('click', closeSheetCliente);
  document.getElementById('sheetCliente').addEventListener('click', function (e) { if (e.target === this) closeSheetCliente(); });
  document.getElementById('btnClienteCancelar').addEventListener('click', closeSheetCliente);
  document.getElementById('btnClienteSalvar').addEventListener('click', function () {
    var contatoId = selectedContatoId;
    var cnpjEl = document.getElementById('cliente_cnpj');
    var tipoEl = document.getElementById('cliente_tipo_pessoa');
    var cnpj = (cnpjEl && cnpjEl.value) ? cnpjEl.value.replace(/\D/g, '') : '';
    if (contatoId && cnpj.length === 14 && tipoEl) {
      fetch(API + '/fiscal/contatos/verificar-contribuinte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj: cnpj, tipo_pessoa: tipoEl.value || 'pj', contatoId: contatoId })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var ieEl = document.getElementById('cliente_inscricao_estadual');
          if (ieEl && data.ie != null) ieEl.value = data.ie || '';
          var nfIe = document.getElementById('nf_inscricao_estadual_destinatario');
          var nfInd = document.getElementById('nf_indicador_ie_dest');
          if (nfIe && data.ie != null) nfIe.value = data.ie || '';
          if (nfInd && data.indIEDest != null) nfInd.value = String(data.indIEDest);
          closeSheetCliente();
        })
        .catch(function () { closeSheetCliente(); });
    } else {
      closeSheetCliente();
    }
  });
  var alertModalEl = document.getElementById('modalAlertaContribuinte');
  if (alertModalEl) {
    document.getElementById('modalAlertaContribuinteClose').addEventListener('click', closeModalAlertaContribuinte);
    document.getElementById('modalAlertaContribuinteOk').addEventListener('click', closeModalAlertaContribuinte);
    alertModalEl.addEventListener('click', function (e) { if (e.target === alertModalEl) closeModalAlertaContribuinte(); });
  }
  document.querySelectorAll('.btn-edit-endereco').forEach(function (btn) {
    btn.addEventListener('click', function () { openModalClienteEndereco(this.getAttribute('data-tipo')); });
  });
  var addCardEl = document.getElementById('clienteEnderecoCardAdd');
  if (addCardEl) {
    addCardEl.addEventListener('click', function () { openModalClienteEndereco('entrega'); });
    addCardEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModalClienteEndereco('entrega'); } });
  }
  var nfAddEnderecoBtn = document.getElementById('nfDestinatarioEnderecoAddBtn');
  if (nfAddEnderecoBtn) {
    nfAddEnderecoBtn.addEventListener('click', function () {
      if (selectedContatoId) {
        fetch(API + '/fiscal/contatos/' + selectedContatoId)
          .then(function (r) { return r.json(); })
          .then(function (contato) { openModalCliente(contato || {}); })
          .catch(function () { openModalCliente({}); });
      }
    });
  }
  renderNfDestinatarioEnderecos();
  document.getElementById('btnClienteEnderecoVoltar').addEventListener('click', function () { showClienteView('form'); });
  document.getElementById('btnClienteEnderecoSalvar').addEventListener('click', function () { saveClienteEndereco(); });
  document.getElementById('btnClienteBuscarCnpj').addEventListener('click', function () {
    var cnpj = document.getElementById('cliente_cnpj').value.replace(/\D/g, '');
    if (cnpj.length !== 14) return;
    fetch('https://brasilapi.com.br/api/cnpj/v1/' + cnpj)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.razao_social) {
          document.getElementById('cliente_razao_social').value = d.razao_social || '';
          document.getElementById('cliente_nome_fantasia').value = d.nome_fantasia || d.razao_social || '';
        }
      })
      .catch(function () { });
  });

  // Cálculo automático toggle
  (function () {
    var toggle = document.getElementById('nfCalcAutoToggle');
    var label = document.getElementById('nfCalcAutoLabel');
    if (toggle && label) {
      applyCalcAutoInputsState();
      toggle.addEventListener('click', function () {
        toggle.classList.toggle('on');
        label.textContent = toggle.classList.contains('on') ? 'Ativado' : 'Desativado';
        toggle.setAttribute('aria-checked', toggle.classList.contains('on') ? 'true' : 'false');
        applyCalcAutoInputsState();
        if (toggle.classList.contains('on')) updateModalCalcTotais();
      });
    }
    var freteEl = document.getElementById('nf_valor_frete');
    var descEl = document.getElementById('nf_valor_desconto');
    if (freteEl) freteEl.addEventListener('input', updateModalCalcTotais);
    if (descEl) descEl.addEventListener('input', updateModalCalcTotais);
  })();
}

(async function init() {
  initFlatpickr();
  initBindings();
  await loadEmpresas();
  await loadNaturezas();
  updateClienteBtnIcon();
  if (typeof lucide !== 'undefined') lucide.createIcons();
  var invoiceId = new URLSearchParams(window.location.search).get('invoiceId');
  if (invoiceId) await loadByInvoiceId(invoiceId);
})();

