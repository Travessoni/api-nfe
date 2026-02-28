/* global lucide */
var API = typeof window !== 'undefined' && window.location && window.location.origin
  ? window.location.origin
  : '';

function setPageMessage(text, type) {
  var el = document.getElementById('naturezasPageMessage');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'message ' + (type || 'info');
  el.style.display = text ? 'block' : 'none';
}

var naturezasList = [];
var regrasByTab = {
  icms: [], ipi: [], pis: [], cofins: [], issqn: [], outros: [], retencoes: [],
  is: [], cbs: [], ibs: []
};

// Normalize tab key: sheet uses data-tab="icms" etc.; content id is sheetNatTabIcms
function getTabContentId(tabKey) {
  return 'sheetNatTab' + tabKey.charAt(0).toUpperCase() + tabKey.slice(1);
}

var empresasList = [];

function loadEmpresasForNaturezasPage() {
  var sel = document.getElementById('naturezasEmpresaId');
  var selNat = document.getElementById('natEmpresa');
  fetch(API + '/fiscal/empresas')
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
    .then(function (result) {
      var list = result.ok && Array.isArray(result.data) ? result.data : [];
      empresasList = list;
      var opts = list.map(function (e) { return '<option value="' + (e.id || '') + '">' + escapeHtml(e.razao_social || e.nome || 'Empresa ' + e.id) + '</option>'; });
      if (sel) sel.innerHTML = '<option value="">Todas empresas</option>' + opts.join('');
      if (selNat) selNat.innerHTML = '<option value="">Nenhuma (global)</option>' + opts.join('');
    })
    .catch(function () {
      empresasList = [];
      if (sel) sel.innerHTML = '<option value="">Todas empresas</option>';
      if (selNat) selNat.innerHTML = '<option value="">Nenhuma (global)</option>';
    });
}

function loadNaturezas() {
  var empresaIdEl = document.getElementById('naturezasEmpresaId');
  var url = API + '/fiscal/naturezas';
  if (empresaIdEl && empresaIdEl.value) {
    url += '?empresa_id=' + encodeURIComponent(empresaIdEl.value);
  }
  return fetch(url)
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
    .then(function (result) {
      if (!result.ok) {
        naturezasList = [];
        setPageMessage(result.data?.message || 'Erro ao carregar naturezas.', 'error');
        renderNaturezasTable();
        return;
      }
      naturezasList = Array.isArray(result.data) ? result.data : [];
      setPageMessage('', '');
      renderNaturezasTable();
    })
    .catch(function (err) {
      naturezasList = [];
      setPageMessage('Erro ao carregar naturezas. Verifique a conexão.', 'error');
      renderNaturezasTable();
    });
}

function renderNaturezasTable() {
  var tbody = document.getElementById('naturezasTableBody');
  var emptyEl = document.getElementById('naturezasEmpty');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (emptyEl) emptyEl.style.display = naturezasList.length ? 'none' : 'block';

  naturezasList.forEach(function (n) {
    var empresaNome = '—';
    if (n.empresa != null && empresasList.length) {
      var emp = empresasList.find(function (e) { return Number(e.id) === Number(n.empresa); });
      if (emp) empresaNome = escapeHtml(emp.razao_social || emp.nome || '');
    }
    var tr = document.createElement('tr');
    tr.dataset.id = String(n.id);
    tr.innerHTML =
      '<td class="col-desc">' + escapeHtml(n.descricao || '') + '</td>' +
      '<td>' + empresaNome + '</td>' +
      '<td class="col-del"><span class="col-del-btns">' +
      '<button type="button" class="btn-lupa btn-edit-natureza" data-id="' + n.id + '" aria-label="Editar" title="Editar"><i data-lucide="pen"></i></button>' +
      '<button type="button" class="btn-lupa btn-remove-natureza" data-id="' + n.id + '" aria-label="Excluir" title="Excluir"><i data-lucide="trash-2"></i></button>' +
      '</span></td>';
    tr.querySelector('.col-desc').style.cursor = 'pointer';
    tr.querySelector('.col-desc').addEventListener('click', function () { openSheetNatureza(n.id); });
    tr.querySelector('.btn-edit-natureza').addEventListener('click', function (e) {
      e.stopPropagation();
      openSheetNatureza(Number(this.getAttribute('data-id')));
    });
    tr.querySelector('.btn-remove-natureza').addEventListener('click', function (e) {
      e.stopPropagation();
      var id = Number(this.getAttribute('data-id'));
      if (window.confirm('Excluir esta natureza de operação?')) {
        // TODO: chamar API DELETE quando existir
        setPageMessage('Exclusão será implementada com o endpoint.', 'info');
      }
    });
    tbody.appendChild(tr);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function escapeHtml(s) {
  var div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function openSheetNatureza(id) {
  var sheet = document.getElementById('sheetNatureza');
  var natId = document.getElementById('natId');
  natId.value = id ? String(id) : '';
  clearSheetForm();
  if (id) {
    fetch(API + '/fiscal/naturezas/' + id)
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (result) {
        if (result.ok && result.data) fillSheetForm(result.data);
        sheet.classList.add('open');
        if (window.modalScrollLock && typeof window.modalScrollLock.lock === 'function') window.modalScrollLock.lock();
      })
      .catch(function () {
        setPageMessage('Natureza não encontrada.', 'error');
        sheet.classList.add('open');
        if (window.modalScrollLock && typeof window.modalScrollLock.lock === 'function') window.modalScrollLock.lock();
      });
  } else {
    sheet.classList.add('open');
    if (window.modalScrollLock && typeof window.modalScrollLock.lock === 'function') window.modalScrollLock.lock();
  }
}

function clearSheetForm() {
  document.getElementById('natDescricao').value = '';
  var natEmpresa = document.getElementById('natEmpresa');
  if (natEmpresa) natEmpresa.value = '';
  document.getElementById('natSerie').value = '1';
  document.getElementById('natTipo').value = 'saida';
  document.getElementById('natRegimeTributario').value = '1';
  document.getElementById('natIndicadorPresenca').value = '9';
  setToggle('natFaturada', true);
  setToggle('natConsumidorFinal', true);
  setToggle('natOperacaoDevolucao', false);
  document.getElementById('natIncluirFreteBaseIpi').checked = true;
  var tabs = ['icms', 'ipi', 'pis', 'cofins', 'issqn', 'is', 'cbs', 'ibs'];
  tabs.forEach(function (t) {
    regrasByTab[t] = [];
    renderRegrasTable(t);
  });
  document.getElementById('natPresumidoPisCofins').value = 'sim';
  document.getElementById('natSomarOutrasDespesas').value = 'nao';
  document.getElementById('natAliquotaFunrural').value = '0';
  document.getElementById('natCompraProdutorRural').value = 'nao';
  document.getElementById('natDescontarFunrural').value = 'sim';
  document.getElementById('natTipoPercAproxTrib').value = 'aliquota_tabela';
  document.getElementById('natTipoDesconto').value = 'condicional';
  document.getElementById('natPossuiRetencaoCsrf').value = 'nao';
  document.getElementById('natPossuiRetencaoIr').value = 'nao';
  document.getElementById('natAliquotaCsrfRetido').value = '0';
  document.getElementById('natAliquotaIrRetido').value = '0';
}

function setToggle(id, on) {
  var el = document.getElementById(id);
  if (!el) return;
  if (on) el.classList.add('on'); else el.classList.remove('on');
  el.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function fillSheetForm(data) {
  if (!data) return;
  var get = function (key) { return data[key] != null ? data[key] : data[key.replace(/([A-Z])/g, '_$1').toLowerCase()]; };
  var setVal = function (id, val, def) {
    var el = document.getElementById(id);
    if (!el) return;
    if (val != null && val !== '') el.value = String(val);
    else if (def !== undefined) el.value = String(def);
  };
  var setNum = function (id, val, def) {
    var el = document.getElementById(id);
    if (!el) return;
    var n = val != null ? Number(val) : (def != null ? Number(def) : NaN);
    el.value = !isNaN(n) ? String(n) : (def != null ? String(def) : '');
  };

  setVal('natDescricao', get('descricao'));
  setVal('natEmpresa', get('empresa') != null && get('empresa') !== '' ? String(get('empresa')) : '', '');
  setVal('natSerie', get('serie'), '1');
  if (get('tipo') != null) {
    var t = String(get('tipo')).toLowerCase();
    document.getElementById('natTipo').value = t.indexOf('entrada') !== -1 ? 'entrada' : 'saida';
  }
  var regimeVal = get('cod_regimeTributario') ?? get('cod_regime_tributario') ?? get('codRegimeTributario');
  var indicadorVal = get('indicadorPresenca') ?? get('indicador_presenca');
  setVal('natRegimeTributario', regimeVal != null && String(regimeVal).trim() !== '' ? String(regimeVal).trim() : null, '1');
  setVal('natIndicadorPresenca', indicadorVal != null && String(indicadorVal).trim() !== '' ? String(indicadorVal).trim() : null, '9');
  setToggle('natFaturada', get('faturada') === true || get('faturada') === 'true');
  setToggle('natConsumidorFinal', get('consumidorFinal') !== false && get('consumidorFinal') !== 'false');
  setToggle('natOperacaoDevolucao', get('operacaoDevolucao') === true || get('operacaoDevolucao') === 'true');

  var incluirFrete = get('incluirFreteBaseIpi') ?? get('incluir_frete_base_ipi');
  var elIpi = document.getElementById('natIncluirFreteBaseIpi');
  if (elIpi) elIpi.checked = incluirFrete !== false && incluirFrete !== 'false';

  setVal('natPresumidoPisCofins', get('presumidoPisCofins') || get('presumido_pis_cofins'), 'sim');
  setVal('natSomarOutrasDespesas', get('somarOutrasDespesas') || get('somar_outras_despesas'), 'nao');
  setVal('natAliquotaFunrural', get('aliquotaFunrural') || get('aliquota_funrural'), '0');
  setVal('natCompraProdutorRural', get('compraProdutorRural') || get('compra_produtor_rural'), 'nao');
  setVal('natDescontarFunrural', get('descontarFunrural') || get('descontar_funrural'), 'sim');
  setVal('natTipoPercAproxTrib', get('tipoPercAproxTrib') || get('tipo_perc_aprox_trib'), 'aliquota_tabela');
  setVal('natTipoDesconto', get('tipoDesconto') || get('tipo_desconto'), 'condicional');
  setVal('natPossuiRetencaoCsrf', get('possuiRetencaoCsrf') || get('possui_retencao_csrf'), 'nao');
  setVal('natPossuiRetencaoIr', get('possuiRetencaoIr') || get('possui_retencao_ir'), 'nao');
  setNum('natAliquotaCsrfRetido', get('aliquotaCsrfRetido') ?? get('aliquota_csrf_retido'), 0);
  setNum('natAliquotaIrRetido', get('aliquotaIrRetido') ?? get('aliquota_ir_retido'), 0);

  var regras = data.regras || {};
  var r = function (key) { return regras[key] != null ? regras[key] : []; };

  regrasByTab.icms = (r('icms') || []).map(function (row) {
    return {
      destinos: row.destinos ?? 'Qualquer',
      produtos: 'Qualquer',
      cfop: row.cfop ?? '',
      aliquota: row.aliquota_icms != null ? row.aliquota_icms : (row.aliquota != null ? row.aliquota : 0),
      base: row.base_calculo_percentual != null ? row.base_calculo_percentual : (row.base != null ? row.base : 100),
      situacaoTributaria: row.situacaoTributaria ?? row.situacao_tributaria ?? ''
    };
  });
  regrasByTab.pis = (r('pis') || []).map(function (row) {
    return {
      destinos: row.destinos ?? 'Qualquer',
      produtos: 'Qualquer',
      aliquota: row.aliquota != null ? row.aliquota : 0,
      base: row.base != null ? row.base : 100,
      situacaoTributaria: row.situacaoTributaria ?? row.situacao_tributaria ?? ''
    };
  });
  regrasByTab.cofins = (r('cofins') || []).map(function (row) {
    return {
      destinos: row.destinos ?? 'Qualquer',
      produtos: 'Qualquer',
      aliquota: row.aliquota != null ? row.aliquota : 0,
      base: row.base != null ? row.base : 100,
      situacaoTributaria: row.situacaoTributaria ?? row.situacao_tributaria ?? ''
    };
  });
  regrasByTab.ipi = (r('ipi') || []).map(function (row) {
    return {
      destinos: row.destinos ?? 'Qualquer',
      produtos: 'Qualquer',
      aliquota: row.aliq != null ? row.aliq : (row.aliquota != null ? row.aliquota : 0),
      base: 100,
      situacaoTributaria: row.situacaoTributaria ?? row.situacao_tributaria ?? '',
      codEnquadramento: row.codEnquadramento ?? row.cod_enquadramento ?? ''
    };
  });
  if (regras.retencoes && typeof regras.retencoes === 'object') {
    var ret = regras.retencoes;
    regrasByTab.retencoes = [{
      destinos: 'Qualquer',
      produtos: 'Qualquer',
      aliquota: ret.aliquota_csrf ?? ret.aliquotaCsrf ?? 0,
      base: 100,
      situacaoTributaria: ret.possui_retencao_csrf || ret.possuiRetencaoCsrf ? 'CSRF' : ''
    }];
  } else regrasByTab.retencoes = [];
  if (regras.is && typeof regras.is === 'object') {
    var isRow = regras.is;
    regrasByTab.is = [{
      destinos: isRow.destinos ?? 'Qualquer',
      produtos: 'Qualquer',
      aliquota: isRow.aliquota != null ? isRow.aliquota : 0,
      base: isRow.base != null ? isRow.base : 100,
      situacaoTributaria: isRow.situacaoTributaria ?? isRow.situacao_tributaria ?? ''
    }];
  } else regrasByTab.is = [];
  if (regras.ibs && typeof regras.ibs === 'object') {
    var ibsRow = regras.ibs;
    regrasByTab.ibs = [{
      destinos: ibsRow.destinos ?? 'Qualquer',
      produtos: 'Qualquer',
      aliquota: ibsRow.aliquota != null ? ibsRow.aliquota : 0,
      base: ibsRow.base != null ? ibsRow.base : 100,
      situacaoTributaria: ibsRow.situacaoTributaria ?? ibsRow.situacao_tributaria ?? ''
    }];
  } else regrasByTab.ibs = [];
  if (regras.cbs && typeof regras.cbs === 'object') {
    var cbsRow = regras.cbs;
    regrasByTab.cbs = [{
      destinos: cbsRow.destinos ?? 'Qualquer',
      produtos: 'Qualquer',
      aliquota: cbsRow.aliquota != null ? cbsRow.aliquota : 0,
      base: cbsRow.base != null ? cbsRow.base : 100,
      situacaoTributaria: cbsRow.situacaoTributaria ?? cbsRow.situacao_tributaria ?? ''
    }];
  } else regrasByTab.cbs = [];
  regrasByTab.issqn = []; // backend não retorna regras ISSQN por enquanto

  var tabs = ['icms', 'ipi', 'pis', 'cofins', 'issqn', 'outros', 'retencoes', 'is', 'cbs', 'ibs'];
  tabs.forEach(function (t) { renderRegrasTable(t); });
}

function closeSheetNatureza() {
  document.getElementById('sheetNatureza').classList.remove('open');
  if (window.modalScrollLock && typeof window.modalScrollLock.unlock === 'function') window.modalScrollLock.unlock();
  loadNaturezas();
}

function renderRegrasTable(tabKey) {
  var bodyId = 'regrasBody' + tabKey.charAt(0).toUpperCase() + tabKey.slice(1);
  var tbody = document.getElementById(bodyId);
  if (!tbody) return;
  var list = regrasByTab[tabKey] || [];
  tbody.innerHTML = '';
  var hasCfop = tabKey === 'icms';
  list.forEach(function (r, i) {
    var tr = document.createElement('tr');
    tr.dataset.index = String(i);
    var num = i + 1;
    var cfopCell = hasCfop ? '<td><input type="text" class="regra-cfop" value="' + escapeHtml(r.cfop || '') + '" placeholder="x102"></td>' : '';
    tr.innerHTML =
      '<td class="col-num">' + num + '</td>' +
      '<td><input type="text" class="regra-destinos" value="' + escapeHtml(r.destinos || 'Qualquer') + '" placeholder="Qualquer"></td>' +
      '<td><input type="text" class="regra-produtos" value="' + escapeHtml(r.produtos || 'Qualquer') + '" placeholder="Qualquer"></td>' +
      cfopCell +
      '<td><input type="number" class="regra-aliquota" step="0.0001" value="' + (r.aliquota != null ? r.aliquota : '') + '" placeholder="0"></td>' +
      '<td><input type="number" class="regra-base" step="0.0001" value="' + (r.base != null ? r.base : '100') + '" placeholder="100"></td>' +
      '<td><input type="text" class="regra-situacao" value="' + escapeHtml(r.situacaoTributaria || '') + '" placeholder="Situação tributária"></td>' +
      '<td class="col-del"><span class="col-del-btns">' +
      '<button type="button" class="btn-lupa btn-edit-regra" data-tab="' + tabKey + '" data-index="' + i + '" aria-label="Editar" title="Editar"><i data-lucide="pen"></i></button>' +
      '<button type="button" class="btn-lupa btn-del-regra" aria-label="Excluir" title="Excluir"><i data-lucide="trash-2"></i></button></span></td>';
    tr.querySelector('.btn-edit-regra').addEventListener('click', function (e) {
      e.stopPropagation();
      openModalAdicionarRegra(this.getAttribute('data-tab'), parseInt(this.getAttribute('data-index'), 10));
    });
    tr.querySelector('.btn-del-regra').addEventListener('click', function () {
      regrasByTab[tabKey].splice(i, 1);
      renderRegrasTable(tabKey);
    });
    tbody.appendChild(tr);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function setModalUfFromDestinos(gridSelector, nameAttr, resumoId, destinosStr, emptyLabel) {
  var list = (destinosStr || '').trim();
  var isQualquer = !list || list === 'Qualquer' || list === 'Qualquer estado';
  var ufs = isQualquer ? [] : list.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  document.querySelectorAll(gridSelector + ' input[name="' + nameAttr + '"]').forEach(function (cb) {
    cb.checked = ufs.indexOf(cb.value) >= 0;
  });
  var resumo = document.getElementById(resumoId);
  if (resumo) resumo.textContent = ufs.length > 0 ? ufs.join(', ') : (emptyLabel || 'Qualquer');
}

function fillModalRegraFromRow(tabKey, index) {
  var r = regrasByTab[tabKey] && regrasByTab[tabKey][index];
  if (!r) return;
  var destinosStr = r.destinos || 'Qualquer';
  if (tabKey === 'icms') {
    setModalUfFromDestinos('#modalIcmsUfGrid', 'modalIcmsUf', 'modalIcmsDestinosResumo', destinosStr, 'Qualquer estado');
    var cfop = document.getElementById('modalIcmsCfop');
    if (cfop) cfop.value = r.cfop || '';
    var sitVal = r.situacaoTributaria || '';
    var sit = document.getElementById('modalIcmsSituacaoTributaria');
    var csosn = document.getElementById('modalIcmsCsosn');
    if (sitVal && isCsosnCode(sitVal)) {
      if (csosn) csosn.value = sitVal;
      if (sit) sit.value = '00';
    } else {
      if (sit) sit.value = sitVal || '00';
      if (csosn) csosn.value = '102';
    }
    var aliq = document.getElementById('modalIcmsAliq');
    if (aliq) aliq.value = r.aliquota != null ? r.aliquota : '';
    var tipoPartilhaSimples = document.getElementById('modalIcmsPartilhaTipoSimples');
    if (tipoPartilhaSimples) tipoPartilhaSimples.value = r.partilhaTipoSimples === 'normal' ? 'normal' : 'isento';
    var partilhaBase = document.getElementById('modalIcmsPartilhaBase');
    if (partilhaBase) partilhaBase.value = r.partilhaBase != null ? r.partilhaBase : '0';
    var partilhaAliqInterna = document.getElementById('modalIcmsPartilhaAliqInterna');
    if (partilhaAliqInterna) partilhaAliqInterna.value = r.partilhaAliqInterna != null ? r.partilhaAliqInterna : '0';
    var partilhaFcp = document.getElementById('modalIcmsPartilhaFcp');
    if (partilhaFcp) partilhaFcp.value = r.partilhaFcp != null ? r.partilhaFcp : '0';
    updateModalIcmsDestinosResumo();
  } else if (tabKey === 'ipi') {
    setModalUfFromDestinos('#modalIpiUfGrid', 'modalIpiUf', 'modalIpiDestinosResumo', destinosStr, 'Qualquer');
    var sitIpi = document.getElementById('modalIpiSituacaoTributaria');
    if (sitIpi) sitIpi.value = r.situacaoTributaria != null && r.situacaoTributaria !== '' ? r.situacaoTributaria : '';
    var aliqIpi = document.getElementById('modalIpiAliquota');
    if (aliqIpi) aliqIpi.value = r.aliquota != null ? r.aliquota : '0';
    var baseIpi = document.getElementById('modalIpiBase');
    if (baseIpi) baseIpi.value = r.base != null ? r.base : '100';
    var codIpi = document.getElementById('modalIpiCodEnquadramento');
    if (codIpi) codIpi.value = r.codEnquadramento != null && r.codEnquadramento !== '' ? r.codEnquadramento : '999';
    updateModalIpiDestinosResumo();
  } else if (tabKey === 'pis') {
    setModalUfFromDestinos('#modalPisUfGrid', 'modalPisUf', 'modalPisDestinosResumo', destinosStr, 'Qualquer estado');
    var sitPis = document.getElementById('modalPisSituacaoTributaria');
    if (sitPis) sitPis.value = r.situacaoTributaria != null && r.situacaoTributaria !== '' ? r.situacaoTributaria : '49';
    var aliqPis = document.getElementById('modalPisAliquota');
    if (aliqPis) aliqPis.value = r.aliquota != null ? r.aliquota : '0';
    var basePis = document.getElementById('modalPisBase');
    if (basePis) basePis.value = r.base != null ? r.base : '0';
    updateModalPisDestinosResumo();
  } else if (tabKey === 'cofins') {
    setModalUfFromDestinos('#modalCofinsUfGrid', 'modalCofinsUf', 'modalCofinsDestinosResumo', destinosStr, 'Qualquer estado');
    var sitCof = document.getElementById('modalCofinsSituacaoTributaria');
    if (sitCof) sitCof.value = r.situacaoTributaria != null && r.situacaoTributaria !== '' ? r.situacaoTributaria : '49';
    var aliqCof = document.getElementById('modalCofinsAliquota');
    if (aliqCof) aliqCof.value = r.aliquota != null ? r.aliquota : '0';
    var baseCof = document.getElementById('modalCofinsBase');
    if (baseCof) baseCof.value = r.base != null ? r.base : '0';
    updateModalCofinsDestinosResumo();
  } else if (tabKey === 'issqn') {
    var sitIss = document.getElementById('modalIssqnSituacaoTributaria');
    if (sitIss) sitIss.value = r.situacaoTributaria != null && r.situacaoTributaria !== '' ? r.situacaoTributaria : 'isento';
    var aliqIss = document.getElementById('modalIssqnAliquota');
    if (aliqIss) aliqIss.value = r.aliquota != null ? r.aliquota : '0';
    var baseIss = document.getElementById('modalIssqnBase');
    if (baseIss) baseIss.value = r.base != null ? r.base : '0';
    var descontarIss = document.getElementById('modalIssqnDescontar');
    if (descontarIss) descontarIss.value = r.descontarIss != null && r.descontarIss !== '' ? r.descontarIss : '';
    var reterIss = document.getElementById('modalIssqnReter');
    if (reterIss) reterIss.value = r.reterIss != null && r.reterIss !== '' ? r.reterIss : 'nao';
  }
}

function openModalAdicionarRegra(tabKey, editIndex) {
  var overlay = document.getElementById('modalAdicionarRegra');
  var panel = document.getElementById('modalRegraPanel');
  var titulo = document.getElementById('modalRegraTitulo');
  var generic = document.getElementById('modalRegraContentGeneric');
  var icms = document.getElementById('modalRegraContentIcms');
  var btnSalvar = document.getElementById('modalRegraSalvar');

  overlay.classList.add('open');
  overlay.dataset.currentTab = tabKey || '';
  overlay.dataset.editIndex = (editIndex !== undefined && editIndex >= 0) ? String(editIndex) : '';

  if (tabKey === 'icms') {
    panel.classList.add('modal-regra-panel-icms');
    titulo.textContent = 'Regras do ICMS';
    generic.style.display = 'none';
    icms.style.display = 'block';
    if (document.getElementById('modalRegraContentIpi')) document.getElementById('modalRegraContentIpi').style.display = 'none';
    if (btnSalvar) btnSalvar.style.display = 'inline-flex';
    applyModalIcmsRegime();
    updateModalIcmsDestinosResumo();
    document.querySelectorAll('#modalIcmsUfGrid input[name="modalIcmsUf"]').forEach(function (cb) {
      cb.removeEventListener('change', updateModalIcmsDestinosResumo);
      cb.addEventListener('change', updateModalIcmsDestinosResumo);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (editIndex >= 0) fillModalRegraFromRow(tabKey, editIndex);
  } else if (tabKey === 'ipi') {
    panel.classList.add('modal-regra-panel-icms');
    titulo.textContent = 'Regras do IPI';
    generic.style.display = 'none';
    icms.style.display = 'none';
    var ipiEl = document.getElementById('modalRegraContentIpi');
    if (ipiEl) ipiEl.style.display = 'block';
    if (document.getElementById('modalRegraContentPis')) document.getElementById('modalRegraContentPis').style.display = 'none';
    if (btnSalvar) btnSalvar.style.display = 'inline-flex';
    applyModalIpiRegime();
    updateModalIpiDestinosResumo();
    document.querySelectorAll('#modalIpiUfGrid input[name="modalIpiUf"]').forEach(function (cb) {
      cb.removeEventListener('change', updateModalIpiDestinosResumo);
      cb.addEventListener('change', updateModalIpiDestinosResumo);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (editIndex >= 0) fillModalRegraFromRow(tabKey, editIndex);
  } else if (tabKey === 'pis') {
    panel.classList.add('modal-regra-panel-icms');
    titulo.textContent = 'Regras do PIS';
    generic.style.display = 'none';
    icms.style.display = 'none';
    if (document.getElementById('modalRegraContentIpi')) document.getElementById('modalRegraContentIpi').style.display = 'none';
    var pisEl = document.getElementById('modalRegraContentPis');
    if (pisEl) pisEl.style.display = 'block';
    if (document.getElementById('modalRegraContentCofins')) document.getElementById('modalRegraContentCofins').style.display = 'none';
    if (btnSalvar) btnSalvar.style.display = 'inline-flex';
    applyModalPisRegime();
    updateModalPisDestinosResumo();
    document.querySelectorAll('#modalPisUfGrid input[name="modalPisUf"]').forEach(function (cb) {
      cb.removeEventListener('change', updateModalPisDestinosResumo);
      cb.addEventListener('change', updateModalPisDestinosResumo);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (editIndex >= 0) fillModalRegraFromRow(tabKey, editIndex);
  } else if (tabKey === 'cofins') {
    panel.classList.add('modal-regra-panel-icms');
    titulo.textContent = 'Regras do COFINS';
    generic.style.display = 'none';
    icms.style.display = 'none';
    if (document.getElementById('modalRegraContentIpi')) document.getElementById('modalRegraContentIpi').style.display = 'none';
    if (document.getElementById('modalRegraContentPis')) document.getElementById('modalRegraContentPis').style.display = 'none';
    var cofinsEl = document.getElementById('modalRegraContentCofins');
    if (cofinsEl) cofinsEl.style.display = 'block';
    if (btnSalvar) btnSalvar.style.display = 'inline-flex';
    applyModalCofinsRegime();
    updateModalCofinsDestinosResumo();
    document.querySelectorAll('#modalCofinsUfGrid input[name="modalCofinsUf"]').forEach(function (cb) {
      cb.removeEventListener('change', updateModalCofinsDestinosResumo);
      cb.addEventListener('change', updateModalCofinsDestinosResumo);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (editIndex >= 0) fillModalRegraFromRow(tabKey, editIndex);
  } else if (tabKey === 'issqn') {
    panel.classList.add('modal-regra-panel-icms');
    titulo.textContent = 'Regras do ISSQN';
    generic.style.display = 'none';
    icms.style.display = 'none';
    if (document.getElementById('modalRegraContentIpi')) document.getElementById('modalRegraContentIpi').style.display = 'none';
    if (document.getElementById('modalRegraContentPis')) document.getElementById('modalRegraContentPis').style.display = 'none';
    if (document.getElementById('modalRegraContentCofins')) document.getElementById('modalRegraContentCofins').style.display = 'none';
    var issqnEl = document.getElementById('modalRegraContentIssqn');
    if (issqnEl) issqnEl.style.display = 'block';
    if (btnSalvar) btnSalvar.style.display = 'inline-flex';
    applyModalIssqnRegime();
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (editIndex >= 0) fillModalRegraFromRow(tabKey, editIndex);
  } else {
    panel.classList.remove('modal-regra-panel-icms');
    titulo.textContent = 'Adicionar regra';
    generic.style.display = 'block';
    icms.style.display = 'none';
    var ipiEl = document.getElementById('modalRegraContentIpi');
    if (ipiEl) ipiEl.style.display = 'none';
    if (document.getElementById('modalRegraContentPis')) document.getElementById('modalRegraContentPis').style.display = 'none';
    if (document.getElementById('modalRegraContentCofins')) document.getElementById('modalRegraContentCofins').style.display = 'none';
    if (document.getElementById('modalRegraContentIssqn')) document.getElementById('modalRegraContentIssqn').style.display = 'none';
    if (btnSalvar) btnSalvar.style.display = 'none';
  }

  if (window.modalScrollLock && typeof window.modalScrollLock.lock === 'function') window.modalScrollLock.lock();
}

function isCsosnCode(val) {
  var v = String(val).trim();
  return ['02', '15', '53', '61', '101', '102', '103', '201', '202', '203', '300', '400', '500', '900'].indexOf(v) !== -1;
}

function applyModalIcmsRegime() {
  var regimeEl = document.getElementById('natRegimeTributario');
  var regime = regimeEl ? regimeEl.value : '';
  var isSimples = regime === '1' || regime === '2';
  var cstBlock = document.getElementById('modalIcmsCstBlock');
  var csosnBlock = document.getElementById('modalIcmsCsosnBlock');
  if (isSimples) {
    if (cstBlock) cstBlock.style.display = 'none';
    if (csosnBlock) csosnBlock.style.display = 'flex';
  } else {
    if (cstBlock) cstBlock.style.display = 'flex';
    if (csosnBlock) csosnBlock.style.display = 'none';
  }
  document.querySelectorAll('.modal-icms-regime-normal').forEach(function (el) {
    el.style.display = isSimples ? 'none' : 'flex';
  });
  var partilhaNormal = document.getElementById('modalIcmsPartilhaNormalBlock');
  var partilhaSimples = document.getElementById('modalIcmsPartilhaSimplesBlock');
  if (partilhaNormal) partilhaNormal.style.display = isSimples ? 'none' : 'block';
  if (partilhaSimples) partilhaSimples.style.display = isSimples ? 'block' : 'none';
}

function updateModalIcmsDestinosResumo() {
  var resumo = document.getElementById('modalIcmsDestinosResumo');
  if (!resumo) return;
  var checkboxes = document.querySelectorAll('#modalIcmsUfGrid input[name="modalIcmsUf"]:checked');
  var ufs = Array.prototype.map.call(checkboxes, function (cb) { return cb.value; });
  resumo.textContent = ufs.length > 0 ? ufs.join(', ') : 'Qualquer estado';
}

function applyModalIpiRegime() {
  var regimeEl = document.getElementById('natRegimeTributario');
  var regime = regimeEl ? regimeEl.value : '';
  var editIndex = document.getElementById('modalAdicionarRegra').dataset.editIndex;
  var isNew = editIndex === undefined || editIndex === '';
  if (regime === '1' && isNew) {
    var sitIpi = document.getElementById('modalIpiSituacaoTributaria');
    if (sitIpi) sitIpi.value = '';
    var aliqIpi = document.getElementById('modalIpiAliquota');
    if (aliqIpi) aliqIpi.value = '0';
    var baseIpi = document.getElementById('modalIpiBase');
    if (baseIpi) baseIpi.value = '100';
    var codIpi = document.getElementById('modalIpiCodEnquadramento');
    if (codIpi) codIpi.value = '999';
  }
}

function updateModalIpiDestinosResumo() {
  var resumo = document.getElementById('modalIpiDestinosResumo');
  if (!resumo) return;
  var checkboxes = document.querySelectorAll('#modalIpiUfGrid input[name="modalIpiUf"]:checked');
  var ufs = Array.prototype.map.call(checkboxes, function (cb) { return cb.value; });
  resumo.textContent = ufs.length > 0 ? ufs.join(', ') : 'Qualquer';
}

function applyModalPisRegime() {
  var regimeEl = document.getElementById('natRegimeTributario');
  var regime = regimeEl ? regimeEl.value : '';
  var editIndex = document.getElementById('modalAdicionarRegra').dataset.editIndex;
  var isNew = editIndex === undefined || editIndex === '';
  if (regime === '1' && isNew) {
    var sitPis = document.getElementById('modalPisSituacaoTributaria');
    if (sitPis) sitPis.value = '49';
    var aliqPis = document.getElementById('modalPisAliquota');
    if (aliqPis) aliqPis.value = '0';
    var basePis = document.getElementById('modalPisBase');
    if (basePis) basePis.value = '0';
  }
}

function updateModalPisDestinosResumo() {
  var resumo = document.getElementById('modalPisDestinosResumo');
  if (!resumo) return;
  var checkboxes = document.querySelectorAll('#modalPisUfGrid input[name="modalPisUf"]:checked');
  var ufs = Array.prototype.map.call(checkboxes, function (cb) { return cb.value; });
  resumo.textContent = ufs.length > 0 ? ufs.join(', ') : 'Qualquer estado';
}

function applyModalCofinsRegime() {
  var regimeEl = document.getElementById('natRegimeTributario');
  var regime = regimeEl ? regimeEl.value : '';
  var editIndex = document.getElementById('modalAdicionarRegra').dataset.editIndex;
  var isNew = editIndex === undefined || editIndex === '';
  if (regime === '1' && isNew) {
    var sitCof = document.getElementById('modalCofinsSituacaoTributaria');
    if (sitCof) sitCof.value = '49';
    var aliqCof = document.getElementById('modalCofinsAliquota');
    if (aliqCof) aliqCof.value = '0';
    var baseCof = document.getElementById('modalCofinsBase');
    if (baseCof) baseCof.value = '0';
  }
}

function updateModalCofinsDestinosResumo() {
  var resumo = document.getElementById('modalCofinsDestinosResumo');
  if (!resumo) return;
  var checkboxes = document.querySelectorAll('#modalCofinsUfGrid input[name="modalCofinsUf"]:checked');
  var ufs = Array.prototype.map.call(checkboxes, function (cb) { return cb.value; });
  resumo.textContent = ufs.length > 0 ? ufs.join(', ') : 'Qualquer estado';
}

function applyModalIssqnRegime() {
  var regimeEl = document.getElementById('natRegimeTributario');
  var regime = regimeEl ? regimeEl.value : '';
  var editIndex = document.getElementById('modalAdicionarRegra').dataset.editIndex;
  var isNew = editIndex === undefined || editIndex === '';
  if (regime === '1' && isNew) {
    var sitIss = document.getElementById('modalIssqnSituacaoTributaria');
    if (sitIss) sitIss.value = 'isento';
    var aliqIss = document.getElementById('modalIssqnAliquota');
    if (aliqIss) aliqIss.value = '0';
    var baseIss = document.getElementById('modalIssqnBase');
    if (baseIss) baseIss.value = '0';
    var reterIss = document.getElementById('modalIssqnReter');
    if (reterIss) reterIss.value = 'nao';
    var descontarIss = document.getElementById('modalIssqnDescontar');
    if (descontarIss) descontarIss.value = '';
  }
}

function closeModalAdicionarRegra() {
  var overlay = document.getElementById('modalAdicionarRegra');
  overlay.classList.remove('open');
  delete overlay.dataset.editIndex;
  document.getElementById('modalRegraPanel').classList.remove('modal-regra-panel-icms');
  document.getElementById('modalRegraContentGeneric').style.display = 'block';
  document.getElementById('modalRegraContentIcms').style.display = 'none';
  var ipiEl = document.getElementById('modalRegraContentIpi');
  if (ipiEl) ipiEl.style.display = 'none';
  var pisEl = document.getElementById('modalRegraContentPis');
  if (pisEl) pisEl.style.display = 'none';
  var cofinsEl = document.getElementById('modalRegraContentCofins');
  if (cofinsEl) cofinsEl.style.display = 'none';
  var issqnEl = document.getElementById('modalRegraContentIssqn');
  if (issqnEl) issqnEl.style.display = 'none';
  var btnSalvar = document.getElementById('modalRegraSalvar');
  if (btnSalvar) btnSalvar.style.display = 'none';
  if (window.modalScrollLock && typeof window.modalScrollLock.unlock === 'function') window.modalScrollLock.unlock();
}

function saveModalRegraIcms() {
  var destinos = document.getElementById('modalIcmsDestinosResumo').textContent;
  var regimeEl = document.getElementById('natRegimeTributario');
  var regime = regimeEl ? regimeEl.value : '';
  var isSimples = regime === '1' || regime === '2';
  var situacao;
  if (isSimples) {
    situacao = (document.getElementById('modalIcmsCsosn') || {}).value || '102';
  } else {
    situacao = (document.getElementById('modalIcmsSituacaoTributaria') || {}).value || '00';
  }
  var cfop = (document.getElementById('modalIcmsCfop') || {}).value || '';
  var aliquota = isSimples ? 0 : (parseFloat((document.getElementById('modalIcmsAliq') || {}).value) || 0);
  var base = 100;
  var payload = {
    destinos: destinos || 'Qualquer',
    produtos: 'Qualquer',
    cfop: cfop,
    aliquota: aliquota,
    base: base,
    situacaoTributaria: situacao
  };
  if (isSimples) {
    payload.partilhaTipoSimples = (document.getElementById('modalIcmsPartilhaTipoSimples') || {}).value || 'isento';
    payload.partilhaBase = parseFloat((document.getElementById('modalIcmsPartilhaBase') || {}).value) || 0;
    payload.partilhaAliqInterna = parseFloat((document.getElementById('modalIcmsPartilhaAliqInterna') || {}).value) || 0;
    payload.partilhaFcp = parseFloat((document.getElementById('modalIcmsPartilhaFcp') || {}).value) || 0;
  }
  var editIndex = document.getElementById('modalAdicionarRegra').dataset.editIndex;
  if (editIndex !== undefined && editIndex !== '') {
    var idx = parseInt(editIndex, 10);
    if (!isNaN(idx)) regrasByTab.icms[idx] = payload;
  } else regrasByTab.icms.push(payload);
  renderRegrasTable('icms');
  closeModalAdicionarRegra();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function saveModalRegraIpi() {
  var resumo = document.getElementById('modalIpiDestinosResumo');
  var destinos = resumo ? resumo.textContent : 'Qualquer';
  var situacao = (document.getElementById('modalIpiSituacaoTributaria') || {}).value || '';
  var aliquota = parseFloat((document.getElementById('modalIpiAliquota') || {}).value) || 0;
  var baseEl = document.getElementById('modalIpiBase');
  var base = baseEl ? parseFloat(baseEl.value) : 100;
  if (isNaN(base)) base = 100;
  var codEnquadramento = (document.getElementById('modalIpiCodEnquadramento') || {}).value || '';
  var payload = {
    destinos: destinos || 'Qualquer',
    produtos: 'Qualquer',
    aliquota: aliquota,
    base: base,
    situacaoTributaria: situacao,
    codEnquadramento: codEnquadramento
  };
  var editIndex = document.getElementById('modalAdicionarRegra').dataset.editIndex;
  if (editIndex !== undefined && editIndex !== '') {
    var idx = parseInt(editIndex, 10);
    if (!isNaN(idx)) regrasByTab.ipi[idx] = payload;
  } else regrasByTab.ipi.push(payload);
  renderRegrasTable('ipi');
  closeModalAdicionarRegra();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function saveModalRegraPis() {
  var resumo = document.getElementById('modalPisDestinosResumo');
  var destinos = resumo ? resumo.textContent : 'Qualquer estado';
  var situacao = (document.getElementById('modalPisSituacaoTributaria') || {}).value || '49';
  var aliquota = parseFloat((document.getElementById('modalPisAliquota') || {}).value) || 0;
  var baseEl = document.getElementById('modalPisBase');
  var base = baseEl ? parseFloat(baseEl.value) : 0;
  if (isNaN(base)) base = 0;
  var payload = {
    destinos: destinos || 'Qualquer estado',
    produtos: 'Qualquer',
    aliquota: aliquota,
    base: base,
    situacaoTributaria: situacao
  };
  var editIndex = document.getElementById('modalAdicionarRegra').dataset.editIndex;
  if (editIndex !== undefined && editIndex !== '') {
    var idx = parseInt(editIndex, 10);
    if (!isNaN(idx)) regrasByTab.pis[idx] = payload;
  } else regrasByTab.pis.push(payload);
  renderRegrasTable('pis');
  closeModalAdicionarRegra();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function saveModalRegraCofins() {
  var resumo = document.getElementById('modalCofinsDestinosResumo');
  var destinos = resumo ? resumo.textContent : 'Qualquer estado';
  var situacao = (document.getElementById('modalCofinsSituacaoTributaria') || {}).value || '49';
  var aliquota = parseFloat((document.getElementById('modalCofinsAliquota') || {}).value) || 0;
  var baseEl = document.getElementById('modalCofinsBase');
  var base = baseEl ? parseFloat(baseEl.value) : 0;
  if (isNaN(base)) base = 0;
  var payload = {
    destinos: destinos || 'Qualquer estado',
    produtos: 'Qualquer',
    aliquota: aliquota,
    base: base,
    situacaoTributaria: situacao
  };
  var editIndex = document.getElementById('modalAdicionarRegra').dataset.editIndex;
  if (editIndex !== undefined && editIndex !== '') {
    var idx = parseInt(editIndex, 10);
    if (!isNaN(idx)) regrasByTab.cofins[idx] = payload;
  } else regrasByTab.cofins.push(payload);
  renderRegrasTable('cofins');
  closeModalAdicionarRegra();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function saveModalRegraIssqn() {
  var situacao = (document.getElementById('modalIssqnSituacaoTributaria') || {}).value || 'isento';
  var aliquota = parseFloat((document.getElementById('modalIssqnAliquota') || {}).value) || 0;
  var baseEl = document.getElementById('modalIssqnBase');
  var base = baseEl ? parseFloat(baseEl.value) : 0;
  if (isNaN(base)) base = 0;
  var descontar = (document.getElementById('modalIssqnDescontar') || {}).value || '';
  var reter = (document.getElementById('modalIssqnReter') || {}).value || 'nao';
  var payload = {
    destinos: 'Qualquer',
    produtos: 'Qualquer',
    aliquota: aliquota,
    base: base,
    situacaoTributaria: situacao,
    descontarIss: descontar,
    reterIss: reter
  };
  var editIndex = document.getElementById('modalAdicionarRegra').dataset.editIndex;
  if (editIndex !== undefined && editIndex !== '') {
    var idx = parseInt(editIndex, 10);
    if (!isNaN(idx)) regrasByTab.issqn[idx] = payload;
  } else regrasByTab.issqn.push(payload);
  renderRegrasTable('issqn');
  closeModalAdicionarRegra();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function collectSheetPayload() {
  var idEl = document.getElementById('natId');
  var natEmpresaEl = document.getElementById('natEmpresa');
  var empresaVal = null;
  if (natEmpresaEl && natEmpresaEl.value !== '') {
    var n = parseInt(natEmpresaEl.value, 10);
    if (!isNaN(n) && n > 0) empresaVal = n;
  }
  var payload = {
    id: idEl && idEl.value ? parseInt(idEl.value, 10) : null,
    descricao: document.getElementById('natDescricao').value,
    empresa: empresaVal,
    serie: document.getElementById('natSerie').value || '1',
    tipo: document.getElementById('natTipo').value,
    cod_regimeTributario: document.getElementById('natRegimeTributario').value,
    indicadorPresenca: document.getElementById('natIndicadorPresenca').value,
    faturada: document.getElementById('natFaturada').classList.contains('on'),
    consumidorFinal: document.getElementById('natConsumidorFinal').classList.contains('on'),
    operacaoDevolucao: document.getElementById('natOperacaoDevolucao').classList.contains('on'),
    incluirFreteBaseIpi: document.getElementById('natIncluirFreteBaseIpi').checked,
    presumidoPisCofins: document.getElementById('natPresumidoPisCofins').value,
    somarOutrasDespesas: document.getElementById('natSomarOutrasDespesas').value,
    aliquotaFunrural: document.getElementById('natAliquotaFunrural').value,
    compraProdutorRural: document.getElementById('natCompraProdutorRural').value,
    descontarFunrural: document.getElementById('natDescontarFunrural').value,
    tipoPercAproxTrib: document.getElementById('natTipoPercAproxTrib').value,
    tipoDesconto: document.getElementById('natTipoDesconto').value,
    regras: (function () {
      var regras = {};
      var tabs = ['icms', 'ipi', 'pis', 'cofins', 'issqn', 'outros', 'retencoes', 'is', 'cbs', 'ibs'];
      tabs.forEach(function (k) { regras[k] = (regrasByTab[k] || []).slice(); });
      regras.retencoes = [{
        possuiRetencaoCsrf: (document.getElementById('natPossuiRetencaoCsrf') || {}).value || 'nao',
        possuiRetencaoIr: (document.getElementById('natPossuiRetencaoIr') || {}).value || 'nao',
        aliquotaCsrf: parseFloat((document.getElementById('natAliquotaCsrfRetido') || {}).value) || 0,
        aliquotaIr: parseFloat((document.getElementById('natAliquotaIrRetido') || {}).value) || 0
      }];
      return regras;
    })()
  };
  return payload;
}

function saveSheetNatureza() {
  var payload = collectSheetPayload();
  var id = payload.id;
  var url = API + '/fiscal/naturezas';
  var method = id ? 'PUT' : 'POST';
  if (id) url += '/' + id;
  setPageMessage('Salvando…', 'info');
  fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
    .then(function (result) {
      if (result.ok) {
        setPageMessage('Natureza salva com sucesso.', 'success');
        closeSheetNatureza();
        loadNaturezas();
      } else {
        var d = result.data;
        var msg = (d && d.message) || (d && typeof d.detail === 'string' ? d.detail : (d && d.detail && d.detail.message ? d.detail.message : null)) || 'Erro ao salvar.';
        setPageMessage(msg, 'error');
      }
    })
    .catch(function (err) {
      setPageMessage('Erro ao salvar: ' + (err.message || err), 'error');
    });
}

(function init() {
  document.getElementById('sheetNaturezaClose').addEventListener('click', closeSheetNatureza);
  document.getElementById('sheetNaturezaCancel').addEventListener('click', closeSheetNatureza);
  document.getElementById('sheetNaturezaSave').addEventListener('click', saveSheetNatureza);
  document.getElementById('sheetNatureza').addEventListener('click', function (e) {
    if (e.target.id === 'sheetNatureza') closeSheetNatureza();
  });

  document.querySelectorAll('#sheetNaturezaTabs .sheet-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var t = this.getAttribute('data-tab');
      document.querySelectorAll('#sheetNaturezaTabs .sheet-tab').forEach(function (x) { x.classList.remove('active'); });
      document.querySelectorAll('#sheetNatureza .sheet-tab-content').forEach(function (x) { x.classList.remove('active'); });
      this.classList.add('active');
      var contentId = getTabContentId(t);
      var content = document.getElementById(contentId);
      if (content) content.classList.add('active');
    });
  });

  document.querySelectorAll('.btn-add-regra').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tab = this.getAttribute('data-tab');
      openModalAdicionarRegra(tab);
    });
  });

  document.getElementById('modalAdicionarRegraClose').addEventListener('click', closeModalAdicionarRegra);
  document.getElementById('modalAdicionarRegraFechar').addEventListener('click', closeModalAdicionarRegra);
  document.getElementById('modalRegraSalvar').addEventListener('click', function () {
    var tab = document.getElementById('modalAdicionarRegra').dataset.currentTab;
    if (tab === 'icms') saveModalRegraIcms();
    else if (tab === 'ipi') saveModalRegraIpi();
    else if (tab === 'pis') saveModalRegraPis();
    else if (tab === 'cofins') saveModalRegraCofins();
    else if (tab === 'issqn') saveModalRegraIssqn();
  });
  var consultarBenef = document.getElementById('modalIcmsConsultarBeneficio');
  if (consultarBenef) consultarBenef.addEventListener('click', function (e) { e.preventDefault(); });
  document.getElementById('modalAdicionarRegra').addEventListener('click', function (e) {
    if (e.target.id === 'modalAdicionarRegra') closeModalAdicionarRegra();
  });

  document.querySelectorAll('#sheetNatureza .toggle-switch').forEach(function (tog) {
    tog.addEventListener('click', function () {
      this.classList.toggle('on');
      this.setAttribute('aria-pressed', this.classList.contains('on') ? 'true' : 'false');
    });
  });

  loadEmpresasForNaturezasPage();
  loadNaturezas();

  var filterEmpresa = document.getElementById('naturezasEmpresaId');
  if (filterEmpresa) filterEmpresa.addEventListener('change', function () { loadNaturezas(); });

  var btnNova = document.getElementById('btnNovaNatureza');
  if (btnNova) btnNova.addEventListener('click', function () { openSheetNatureza(null); });

  if (typeof lucide !== 'undefined') lucide.createIcons();
})();
