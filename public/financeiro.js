// ================================================================
//  Financeiro — Grupo Betel  |  Optimized & Restructured
// ================================================================

// ===== CONFIG =====
const SUPABASE_URL = 'https://hjfevtxygjalxkryyeor.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqZmV2dHh5Z2phbHhrcnl5ZW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyNDg2MzgsImV4cCI6MjA1OTgyNDYzOH0.c6TtCFjGYM4lSwA1D7s1uoJUwYFqY1eamn0cp51s8Wc';
const API = '';
const ALLOWED_GROUPS = ['Administração', 'Administrativo'];
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ===== STATE =====
let currentUser = null;
let currentPage = 'dashboard';
let lancPage = 1;
const lancLimit = 20;
let currentTab = 'all';
let instituicoes = [];
let categorias = [];


// ===== DASHBOARD STATE =====
const _dashNow = new Date();
let dashMonth = _dashNow.getFullYear() + '-' + String(_dashNow.getMonth() + 1).padStart(2, '0');
let dashController = null;
let dashChartEvolucao = null;
let dashChartCategorias = null;
let dashAlertaTipo = 'despesa';

// ===== ABORT CONTROLLERS (cancel stale requests) =====
let lancController = null;
let resumoController = null;


// ===== DOM CACHE =====
// Cached once on init — avoids repeated getElementById per render cycle
const DOM = {};

function cacheDom() {
  const ids = [
    'authGate', 'loginEmail', 'loginPassword', 'loginBtn', 'authError',
    'sidebar', 'mainContent', 'sidebarAvatar', 'sidebarName', 'sidebarRole',
    'filterConta', 'filterCategoria', 'filterPeriodoLabel',
    'lancamentosBody', 'lancamentosPagination',
    'totalEntrada', 'totalSaida',
    'lancData', 'lancCompetencia', 'lancValor', 'lancTipo', 'lancConta',
    'lancHistorico', 'lancCatId', 'lancCatInput', 'lancCatDropdown',
    'transValor', 'transData', 'transOrigem', 'transDestino',
    'transOrigemSaldo', 'transDestinoSaldo',
    'contasBody', 'categoriasBody',
    'toast',
    'drOverlay', 'drStartLabel', 'drStartDays', 'drEndLabel', 'drEndDays',
    'drRangeDisplay', 'drMonthSel', 'drMonthYear', 'drMonthGrid',
    'themeToggleBtn', 'themeIcon', 'themeLabel',
    'perfilAvatar', 'perfilNome', 'perfilEmail',
    'perfilThemeDark', 'perfilThemeLight', 'perfilThemeLabel',
    'perfilLogoutBtn', 'sidebarUser',
    'catCounter',
    'dashMonthLabel', 'dashPrevMonth', 'dashNextMonth',
    'dashSaldoInicial', 'dashSaldoAtual', 'dashSaldoPrevisto',
    'dashChartEvolucao', 'dashChartCategorias',
    'dashAlertasBody', 'dashAlertasText', 'dashAlertasVerificar',
    'dashVisaoContas', 'dashVisaoReceitas', 'dashVisaoDespesas', 'dashVisaoTransferencias',
    'dashCatCenter', 'dashCatLegenda', 'dashContasBody',
  ];
  ids.forEach(id => { DOM[id] = document.getElementById(id); });
}


// ===== HELPERS =====

/** Format number as BRL currency */
function fmt(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Format YYYY-MM-DD → DD/MM/YYYY */
function fmtDate(d) {
  if (!d) return '—';
  const p = d.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

/** Timezone-safe YYYY-MM-DD from a Date object */
function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

/** Today as YYYY-MM-DD (local timezone safe) */
function today() { return toLocalDateStr(new Date()); }

/** Escape HTML to prevent XSS */
const _escDiv = document.createElement('div');
function esc(s) {
  if (!s) return '';
  _escDiv.textContent = s;
  return _escDiv.innerHTML;
}

/** Toast notification */
function toast(msg, type) {
  DOM.toast.textContent = msg;
  DOM.toast.className = 'toast ' + type + ' show';
  setTimeout(() => DOM.toast.classList.remove('show'), 3000);
}

/** Modal open/close */
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.classList.add('body-scroll-lock');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.classList.remove('body-scroll-lock');
}

/** Debounced reload for filters */
let _filterTimer = null;
function debouncedReload() {
  clearTimeout(_filterTimer);
  _filterTimer = setTimeout(() => {
    lancPage = 1;
    loadLancamentos();
    loadResumo();
  }, 150);
}


// ===== THEME =====
const THEME_KEY = 'betel-theme';

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  updateThemeUI();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  updateThemeUI();
}

function updateThemeUI() {
  const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
  if (DOM.themeIcon) {
    DOM.themeIcon.innerHTML = isDark
      ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'                                   // lua
      : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'; // sol
  }
  if (DOM.themeLabel) {
    DOM.themeLabel.textContent = isDark ? 'Modo claro' : 'Modo escuro';
  }
}


// ===== PROFILE MODAL =====
function openPerfilModal() {
  if (!currentUser) return;
  const initials = (currentUser.nome || '??').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  DOM.perfilAvatar.textContent = initials;
  if (currentUser.corAvatar) DOM.perfilAvatar.style.background = currentUser.corAvatar;
  DOM.perfilNome.textContent = currentUser.nome || '—';
  DOM.perfilEmail.textContent = currentUser.email || '—';
  updatePerfilThemeUI();
  openModal('modalPerfil');
}

function updatePerfilThemeUI() {
  const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
  if (DOM.perfilThemeDark) DOM.perfilThemeDark.classList.toggle('active', isDark);
  if (DOM.perfilThemeLight) DOM.perfilThemeLight.classList.toggle('active', !isDark);
  if (DOM.perfilThemeLabel) DOM.perfilThemeLabel.textContent = isDark ? 'Modo escuro' : 'Modo claro';
}

function setThemeFromPerfil(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  updateThemeUI();
  updatePerfilThemeUI();
}

async function handleLogout() {
  await sb.auth.signOut();
  window.location.href = 'https://www.betelplus.com/entrar';
}

function initPerfilModal() {
  if (DOM.sidebarUser) DOM.sidebarUser.addEventListener('click', openPerfilModal);
  if (DOM.perfilThemeDark) DOM.perfilThemeDark.addEventListener('click', () => setThemeFromPerfil('dark'));
  if (DOM.perfilThemeLight) DOM.perfilThemeLight.addEventListener('click', () => setThemeFromPerfil('light'));
  if (DOM.perfilLogoutBtn) DOM.perfilLogoutBtn.addEventListener('click', handleLogout);
}


// ===== AUTH =====
async function checkAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) { await onLogin(session.user); return; }
  DOM.authGate.style.display = 'flex';
}

async function handleLogin() {
  const email = DOM.loginEmail.value.trim();
  const password = DOM.loginPassword.value;
  DOM.authError.textContent = '';
  if (!email || !password) { DOM.authError.textContent = 'Preencha e-mail e senha'; return; }
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { DOM.authError.textContent = 'E-mail ou senha incorretos'; return; }
  await onLogin(data.user);
}

async function onLogin(authUser) {
  const { data: usr } = await sb.from('usuarios').select('*').eq('auth_user_id', authUser.id).maybeSingle();
  if (!usr) { DOM.authError.textContent = 'Usuário não encontrado no sistema'; return; }
  if (!ALLOWED_GROUPS.includes(usr.grupoAcesso)) {
    DOM.authGate.querySelector('.auth-form').innerHTML =
      '<div class="access-denied">Sem permissão para acessar o módulo financeiro.<br>' +
      '<small style="color:var(--text-secondary)">Grupo: ' + esc(usr.grupoAcesso || '—') + '</small></div>';
    return;
  }
  currentUser = usr;
  DOM.authGate.style.display = 'none';
  DOM.sidebar.style.display = 'flex';
  DOM.mainContent.style.display = 'block';
  const initials = (usr.nome || '??').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  DOM.sidebarAvatar.textContent = initials;
  if (usr.corAvatar) DOM.sidebarAvatar.style.background = usr.corAvatar;
  DOM.sidebarName.textContent = usr.nome || '—';
  DOM.sidebarRole.textContent = usr.grupoAcesso || '—';
  await loadAll();
}


// ===== NAVIGATION =====
function initNavigation() {
  document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      currentPage = item.dataset.page;
      document.querySelectorAll('.page-view').forEach(p => p.style.display = 'none');
      const pageId = 'page' + currentPage.charAt(0).toUpperCase() + currentPage.slice(1);
      document.getElementById(pageId).style.display = 'block';
      if (currentPage === 'dashboard') loadDashboard();
      if (currentPage === 'contas') loadContas();
      if (currentPage === 'categorias') loadCategoriasPage();
    });
  });
}


// ===== DATA LOADING =====
async function loadAll() {
  await Promise.all([loadInstituicoes(), loadCategorias()]);
  if (currentPage === 'dashboard') loadDashboard();
  else { loadLancamentos(); loadResumo(); }
}

async function loadInstituicoes() {
  const res = await fetch(API + '/financial/instituicoes');
  instituicoes = await res.json();
  populateContaSelects();
}

async function loadCategorias() {
  const res = await fetch(API + '/financial/categorias');
  categorias = await res.json();
  populateCategoriaFilter();
}

function populateContaSelects() {
  ['filterConta', 'lancConta', 'transOrigem', 'transDestino'].forEach(id => {
    const sel = DOM[id] || document.getElementById(id);
    const val = sel.value;
    const first = sel.options[0].outerHTML;
    sel.innerHTML = first;
    instituicoes.forEach(i => {
      const o = document.createElement('option');
      o.value = i.id;
      o.textContent = i.nome;
      sel.appendChild(o);
    });
    sel.value = val;
  });
}

function populateCategoriaFilter() {
  DOM.filterCategoria.innerHTML = '<option value="">Todas categorias</option>';
  categorias.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.nome;
    DOM.filterCategoria.appendChild(o);
  });
}


// ===== LANCAMENTOS =====
async function loadLancamentos() {
  // Cancel previous pending request
  if (lancController) lancController.abort();
  lancController = new AbortController();

  // Loading state
  DOM.lancamentosBody.innerHTML =
    '<tr><td colspan="6"><div class="loading-state">Carregando...</div></td></tr>';
  DOM.lancamentosPagination.innerHTML = '';

  const params = new URLSearchParams({ page: lancPage, limit: lancLimit });
  const conta = DOM.filterConta.value;
  const cat = DOM.filterCategoria.value;
  if (conta) params.set('contaBancaria', conta);
  if (cat) params.set('categoria', cat);
  if (currentTab !== 'all') params.set('tipo', currentTab);
  if (drStart) params.set('dataInicio', drStart);
  if (drEnd) params.set('dataFim', drEnd);

  try {
    const res = await fetch(API + '/financial/lancamentos?' + params, { signal: lancController.signal });
    const json = await res.json();
    renderLancamentos(json.data, json.count, json.page, json.limit);
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error('loadLancamentos error:', e);
      DOM.lancamentosBody.innerHTML =
        '<tr><td colspan="6"><div class="empty-state"><p>Erro ao carregar dados</p></div></td></tr>';
    }
  }
}

function renderLancamentos(rows, count, page, limit) {
  if (!rows || !rows.length) {
    DOM.lancamentosBody.innerHTML =
      '<tr><td colspan="6"><div class="empty-state">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<p>Nenhum resultado encontrado</p></div></td></tr>';
    DOM.lancamentosPagination.innerHTML = '';
    return;
  }

  DOM.lancamentosBody.innerHTML = rows.map(r => {
    const cat = r.financeiro_categorias;
    const inst = r.financeiro_instituicoes;
    const isEntrada = r.tipo === 'Entrada';
    const catHtml = cat
      ? '<span class="cat-badge" style="background:' + esc(cat.cor || '#3F3F46') + '22;color:' + esc(cat.cor || 'var(--text-primary)') + '">' + esc(cat.nome) + '</span>'
      : '—';
    return '<tr>' +
      '<td>' + fmtDate(r.data) + '</td>' +
      '<td>' + catHtml + '</td>' +
      '<td>' + esc(r.historico || '—') + '</td>' +
      '<td>' + esc(inst ? inst.nome : '—') + '</td>' +
      '<td class="' + (isEntrada ? 'valor-entrada' : 'valor-saida') + '">' + (isEntrada ? '' : '- ') + fmt(r.valor) + '</td>' +
      '<td><button class="btn btn-ghost" style="padding:4px 8px;min-height:28px;font-size:12px" onclick="estornar(' + r.id + ')">⤺</button></td>' +
      '</tr>';
  }).join('');

  const totalPages = Math.ceil(count / limit);
  DOM.lancamentosPagination.innerHTML =
    '<span>Página ' + page + ' de ' + totalPages + ' (' + count + ' registros)</span>' +
    '<div class="pagination-btns">' +
    '<button class="btn btn-ghost" ' + (page <= 1 ? 'disabled' : '') + ' onclick="lancPage--;loadLancamentos()">← Anterior</button>' +
    '<button class="btn btn-ghost" ' + (page >= totalPages ? 'disabled' : '') + ' onclick="lancPage++;loadLancamentos()">Próxima →</button>' +
    '</div>';
}

async function loadResumo() {
  // Cancel previous pending request
  if (resumoController) resumoController.abort();
  resumoController = new AbortController();

  const params = new URLSearchParams();
  const conta = DOM.filterConta.value;
  if (conta) params.set('contaBancaria', conta);
  if (drStart) params.set('dataInicio', drStart);
  if (drEnd) params.set('dataFim', drEnd);

  try {
    const res = await fetch(API + '/financial/lancamentos/resumo?' + params, { signal: resumoController.signal });
    const json = await res.json();
    DOM.totalEntrada.textContent = fmt(json.totalEntradas);
    DOM.totalSaida.textContent = fmt(json.totalSaidas);
  } catch (e) {
    if (e.name !== 'AbortError') console.error('loadResumo error:', e);
  }
}

async function estornar(id) {
  if (!confirm('Deseja estornar o lançamento #' + id + '?')) return;
  try {
    const res = await fetch(API + '/financial/lancamentos/' + id + '/estorno', { method: 'POST' });
    if (res.ok) { toast('Lançamento estornado', 'success'); loadLancamentos(); loadResumo(); loadInstituicoes(); }
    else { const e = await res.json().catch(() => ({})); toast(e.message || 'Erro ao estornar', 'error'); }
  } catch (e) { toast('Erro de rede', 'error'); }
}


// ===== TABS =====
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      lancPage = 1;
      loadLancamentos();
    });
  });
}


// ===== FILTERS =====
function initFilters() {
  DOM.filterConta.addEventListener('change', debouncedReload);
  DOM.filterCategoria.addEventListener('change', debouncedReload);
}


// ===== NOVO LANCAMENTO =====
function initLancamento() {
  document.getElementById('btnNovoLancamento').addEventListener('click', () => {
    DOM.lancData.value = today();
    DOM.lancCompetencia.value = today();
    DOM.lancValor.value = '';
    DOM.lancTipo.value = 'Saída';
    DOM.lancConta.value = '';
    DOM.lancHistorico.value = '';
    DOM.lancCatId.value = '';
    DOM.lancCatInput.value = '';
    buildCatSelector();
    openModal('modalLancamento');
  });

  document.getElementById('btnSalvarLancamento').addEventListener('click', async () => {
    const body = {
      data: DOM.lancData.value,
      valor: parseFloat(DOM.lancValor.value) || 0,
      tipo: DOM.lancTipo.value,
      competencia: DOM.lancCompetencia.value || undefined,
      contaBancaria: DOM.lancConta.value,
      historico: DOM.lancHistorico.value || undefined,
      categoria: DOM.lancCatId.value || undefined,
    };
    if (!body.contaBancaria || !body.valor || !body.data) {
      toast('Preencha os campos obrigatórios', 'error');
      return;
    }
    try {
      const res = await fetch(API + '/financial/lancamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        closeModal('modalLancamento');
        toast('Lançamento criado', 'success');

        // Atualização otimista do saldo local
        const conta = instituicoes.find(i => i.id === body.contaBancaria);
        if (conta) conta.saldo += body.tipo === 'Entrada' ? body.valor : -body.valor;

        loadLancamentos();
        loadResumo();
      } else {
        const e = await res.json().catch(() => ({}));
        toast(e.message || 'Erro ao criar lançamento', 'error');
      }
    } catch (e) { toast('Erro de rede', 'error'); }
  });
}


// ===== CATEGORY SELECTOR =====
function buildCatSelector() {
  const dd = DOM.lancCatDropdown;
  function getChildren(parentId) { return categorias.filter(c => (c.idCategoriaPai || null) === parentId); }
  function renderNode(cat, depth) {
    const kids = getChildren(cat.id);
    const hasKids = kids.length > 0;
    const pad = depth * 16;
    let html = '<div class="cat-node" data-id="' + cat.id + '" data-name="' + esc(cat.nome) + '" data-normalized="' + esc(cat.nome_normalized || cat.nome.toLowerCase()) + '" style="padding-left:' + (12 + pad) + 'px" onclick="onCatNodeClick(event, this)">';
    if (hasKids) html += '<svg class="cat-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;transition:transform .2s"><path d="m9 18 6-6-6-6"/></svg>';
    else html += '<span style="width:14px;flex-shrink:0"></span>';
    html += '<span class="cat-node-label">' + esc(cat.nome) + '</span></div>';
    if (hasKids) {
      html += '<div class="cat-subtree" data-parent="' + cat.id + '" style="display:none">';
      kids.forEach(k => { html += renderNode(k, depth + 1); });
      html += '</div>';
    }
    return html;
  }

  let html = '<div class="cat-search-bar">';
  html += '<input type="text" class="cat-search-input" placeholder="Buscar">';
  html += '<span class="cat-search-counter" id="catCounter"></span>';
  html += '<div class="cat-search-nav">';
  html += '<button type="button" onclick="catSearchNav(-1)" title="Anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg></button>';
  html += '<button type="button" onclick="catSearchNav(1)" title="Próximo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button>';
  html += '</div></div>';
  html += '<div class="cat-node" data-id="" data-name="Sem categoria" data-normalized="sem categoria" style="padding-left:12px" onclick="selectCat(\'\', \'Sem categoria\')"><span style="width:14px;flex-shrink:0"></span><span class="cat-node-label">Sem categoria</span></div>';
  getChildren(null).forEach(root => { html += renderNode(root, 0); });
  dd.innerHTML = html;

  // Re-cache catCounter since it was just re-created
  DOM.catCounter = document.getElementById('catCounter');

  const searchEl = dd.querySelector('.cat-search-input');
  if (searchEl) {
    let timer = null;
    searchEl.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(() => filterCatSelector(this.value), 200);
    });
    searchEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); catSearchNav(e.shiftKey ? -1 : 1); }
    });
  }
}

function initCatSelector() {
  DOM.lancCatInput.addEventListener('click', () => {
    const dd = DOM.lancCatDropdown;
    const rect = DOM.lancCatInput.getBoundingClientRect();
    dd.style.width = rect.width + 'px';
    dd.style.left = rect.left + 'px';
    dd.style.bottom = '';
    dd.style.top = rect.top + 'px';
    dd.classList.toggle('open');
    if (dd.classList.contains('open')) {
      const s = dd.querySelector('.cat-search-input');
      if (s) setTimeout(() => s.focus(), 0);
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.cat-selector')) DOM.lancCatDropdown.classList.remove('open');
  });
}

function onCatNodeClick(e, el) {
  e.stopPropagation();
  const subtree = el.nextElementSibling;
  if (subtree && subtree.classList.contains('cat-subtree')) {
    const isOpen = subtree.style.display !== 'none';
    subtree.style.display = isOpen ? 'none' : 'block';
    const arrow = el.querySelector('.cat-arrow');
    if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(90deg)';
  } else {
    selectCat(el.dataset.id, el.dataset.name);
  }
}

function selectCat(id, name) {
  const dd = DOM.lancCatDropdown;
  dd.querySelectorAll('.cat-node.cat-selected').forEach(el => el.classList.remove('cat-selected'));
  const selected = dd.querySelector('.cat-node[data-id="' + id + '"]');
  if (selected) selected.classList.add('cat-selected');
  DOM.lancCatId.value = id;
  DOM.lancCatInput.value = name;
  dd.classList.remove('open');
}

let catMatches = [];
let catMatchIdx = -1;

function filterCatSelector(q) {
  const dd = DOM.lancCatDropdown;
  const ql = q.toLowerCase().trim();
  dd.querySelectorAll('.cat-highlight, .cat-current').forEach(el => el.classList.remove('cat-highlight', 'cat-current'));
  catMatches = [];
  catMatchIdx = -1;

  if (!ql) {
    DOM.catCounter.textContent = '';
    dd.querySelectorAll('.cat-subtree').forEach(s => { s.style.display = 'none'; });
    dd.querySelectorAll('.cat-arrow').forEach(a => { a.style.transform = ''; });
    dd.scrollTop = 0;
    return;
  }

  dd.querySelectorAll('.cat-node').forEach(el => {
    if ((el.dataset.normalized || '').includes(ql)) catMatches.push(el);
  });

  if (!catMatches.length) { DOM.catCounter.textContent = '0'; return; }

  catMatches.forEach(el => {
    el.classList.add('cat-highlight');
    let parent = el.parentElement;
    while (parent && parent !== dd) {
      if (parent.classList.contains('cat-subtree')) {
        parent.style.display = 'block';
        const prev = parent.previousElementSibling;
        if (prev && prev.classList.contains('cat-node')) {
          const arrow = prev.querySelector('.cat-arrow');
          if (arrow) arrow.style.transform = 'rotate(90deg)';
        }
      }
      parent = parent.parentElement;
    }
  });
  catMatchIdx = 0;
  updateCatMatchFocus();
}

function catSearchNav(dir) {
  if (!catMatches.length) return;
  catMatchIdx = (catMatchIdx + dir + catMatches.length) % catMatches.length;
  updateCatMatchFocus();
}

function updateCatMatchFocus() {
  catMatches.forEach(el => el.classList.remove('cat-current'));
  if (catMatchIdx >= 0 && catMatchIdx < catMatches.length) {
    catMatches[catMatchIdx].classList.add('cat-current');
    catMatches[catMatchIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  DOM.catCounter.textContent = catMatches.length ? (catMatchIdx + 1) + '/' + catMatches.length : '';
}


// ===== TRANSFERENCIA =====
function initTransferencia() {
  document.getElementById('btnTransferencia').addEventListener('click', () => {
    DOM.transValor.value = '';
    DOM.transData.value = today();
    DOM.transOrigem.value = '';
    DOM.transDestino.value = '';
    updateTransSaldo();
    openModal('modalTransferencia');
  });

  DOM.transOrigem.addEventListener('change', updateTransSaldo);
  DOM.transDestino.addEventListener('change', updateTransSaldo);

  document.getElementById('btnSalvarTransferencia').addEventListener('click', async () => {
    const body = {
      contaOrigem: DOM.transOrigem.value,
      contaDestino: DOM.transDestino.value,
      valor: parseFloat(DOM.transValor.value) || 0,
      data: DOM.transData.value,
    };
    if (!body.contaOrigem || !body.contaDestino || !body.valor || !body.data) {
      toast('Preencha todos os campos', 'error');
      return;
    }
    try {
      const res = await fetch(API + '/financial/transferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        closeModal('modalTransferencia');
        toast('Transferência realizada', 'success');

        // Atualização otimista dos saldos locais
        const orig = instituicoes.find(i => i.id === body.contaOrigem);
        const dest = instituicoes.find(i => i.id === body.contaDestino);
        if (orig) orig.saldo -= body.valor;
        if (dest) dest.saldo += body.valor;

        loadLancamentos();
        loadResumo();
      } else {
        const e = await res.json().catch(() => ({}));
        toast(e.message || 'Erro na transferência', 'error');
      }
    } catch (e) { toast('Erro de rede', 'error'); }
  });
}

function updateTransSaldo() {
  const o = instituicoes.find(i => i.id === DOM.transOrigem.value);
  const d = instituicoes.find(i => i.id === DOM.transDestino.value);
  DOM.transOrigemSaldo.textContent = 'Saldo: ' + fmt(o ? o.saldo : 0);
  DOM.transDestinoSaldo.textContent = 'Saldo: ' + fmt(d ? d.saldo : 0);
}


// ===== CONTAS PAGE =====
async function loadContas() {
  const res = await fetch(API + '/financial/instituicoes');
  const data = await res.json();
  if (!data.length) {
    DOM.contasBody.innerHTML = '<tr><td colspan="3"><div class="empty-state"><p>Nenhuma conta cadastrada</p></div></td></tr>';
    return;
  }
  DOM.contasBody.innerHTML = data.map(i =>
    '<tr><td>' + esc(i.nome) + '</td><td>' + fmt(i.saldo) + '</td>' +
    '<td><button class="btn btn-ghost" style="padding:4px 8px;min-height:28px;font-size:12px" onclick="deleteConta(\'' + i.id + '\')">Excluir</button></td></tr>'
  ).join('');
}

function initContas() {
  document.getElementById('btnNovaConta').addEventListener('click', () => {
    const nome = prompt('Nome da conta financeira:');
    if (!nome) return;
    fetch(API + '/financial/instituicoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    }).then(r => {
      if (r.ok) { toast('Conta criada', 'success'); loadContas(); loadInstituicoes(); }
      else r.json().then(e => toast(e.message || 'Erro', 'error'));
    });
  });
}

async function deleteConta(id) {
  if (!confirm('Excluir esta conta?')) return;
  const res = await fetch(API + '/financial/instituicoes/' + id, { method: 'DELETE' });
  if (res.ok) { toast('Conta excluída', 'success'); loadContas(); loadInstituicoes(); }
  else toast('Erro ao excluir', 'error');
}


// ===== CATEGORIAS PAGE =====
async function loadCategoriasPage() {
  const res = await fetch(API + '/financial/categorias');
  const data = await res.json();
  if (!data.length) {
    DOM.categoriasBody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><p>Nenhuma categoria cadastrada</p></div></td></tr>';
    return;
  }
  DOM.categoriasBody.innerHTML = data.map(c =>
    '<tr><td>' + esc(c.nome) + (c.idCategoriaPai ? ' <small style="color:var(--text-muted)">(sub)</small>' : '') + '</td>' +
    '<td style="text-transform:capitalize">' + esc(c.tipo || '—') + '</td>' +
    '<td><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:' + esc(c.cor || '#3F3F46') + '"></span></td>' +
    '<td><button class="btn btn-ghost" style="padding:4px 8px;min-height:28px;font-size:12px" onclick="deleteCategoria(\'' + c.id + '\')">Excluir</button></td></tr>'
  ).join('');
}

function initCategorias() {
  document.getElementById('btnNovaCategoria').addEventListener('click', () => {
    const nome = prompt('Nome da categoria:');
    if (!nome) return;
    const tipo = prompt('Tipo (receita ou despesa):');
    if (!tipo || !['receita', 'despesa'].includes(tipo)) {
      toast('Tipo deve ser "receita" ou "despesa"', 'error');
      return;
    }
    fetch(API + '/financial/categorias', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, tipo }),
    }).then(r => {
      if (r.ok) { toast('Categoria criada', 'success'); loadCategoriasPage(); loadCategorias(); }
      else r.json().then(e => toast(e.message || 'Erro', 'error'));
    });
  });
}

async function deleteCategoria(id) {
  if (!confirm('Excluir esta categoria?')) return;
  const res = await fetch(API + '/financial/categorias/' + id, { method: 'DELETE' });
  if (res.ok) { toast('Categoria excluída', 'success'); loadCategoriasPage(); loadCategorias(); }
  else toast('Erro ao excluir', 'error');
}


// ================================================================
//  DASHBOARD
// ================================================================

function initDashboard() {
  DOM.dashPrevMonth.addEventListener('click', () => { dashNavMonth(-1); });
  DOM.dashNextMonth.addEventListener('click', () => { dashNavMonth(1); });
  updateDashMonthLabel();

  // Alertas tabs
  document.querySelectorAll('.dash-alertas-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.dash-alertas-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      dashAlertaTipo = tab.dataset.tipo;
      loadDashAlertas();
    });
  });

  // Verificar button → go to transacoes
  DOM.dashAlertasVerificar.addEventListener('click', () => {
    const navItem = document.querySelector('.sidebar-item[data-page="transacoes"]');
    if (navItem) navItem.click();
  });
}

function dashNavMonth(dir) {
  const [y, m] = dashMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  dashMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  updateDashMonthLabel();
  loadDashboard();
}

function updateDashMonthLabel() {
  const [y, m] = dashMonth.split('-').map(Number);
  const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  DOM.dashMonthLabel.textContent = names[m - 1] + ' ' + y;
}

function loadDashboard() {
  if (dashController) dashController.abort();
  dashController = new AbortController();
  const signal = dashController.signal;

  loadDashResumo(signal);
  loadDashEvolucao(signal);
  loadDashCategorias(signal);
  loadDashContas(signal);
  loadDashAlertas(signal);
}

async function loadDashResumo(signal) {
  try {
    const res = await fetch(API + '/financial/dashboard/resumo?mes=' + dashMonth, { signal });
    const d = await res.json();
    DOM.dashSaldoInicial.textContent = fmt(d.saldoInicial);
    DOM.dashSaldoAtual.textContent = fmt(d.saldoAtual);
    DOM.dashSaldoPrevisto.textContent = fmt(d.saldoPrevisto);
    DOM.dashVisaoContas.textContent = fmt(d.saldoAtual);
    DOM.dashVisaoReceitas.textContent = fmt(d.totalReceitas);
    DOM.dashVisaoDespesas.textContent = fmt(d.totalDespesas);
    DOM.dashVisaoTransferencias.textContent = fmt(d.balancoTransferencias);
  } catch (e) {
    if (e.name !== 'AbortError') console.error('dashResumo error:', e);
  }
}

async function loadDashEvolucao(signal) {
  try {
    const res = await fetch(API + '/financial/dashboard/evolucao?mes=' + dashMonth, { signal });
    const data = await res.json();
    renderDashEvolucao(data);
  } catch (e) {
    if (e.name !== 'AbortError') console.error('dashEvolucao error:', e);
  }
}

function renderDashEvolucao(data) {
  if (dashChartEvolucao) dashChartEvolucao.destroy();
  const ctx = DOM.dashChartEvolucao.getContext('2d');
  const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#A1A1AA' : '#71717A';

  const labels = data.map(d => { const p = d.data.split('-'); return p[2] + '/' + p[1]; });
  const values = data.map(d => d.valor);

  const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.clientHeight || 180);
  gradient.addColorStop(0, 'rgba(239,68,68,0.25)');
  gradient.addColorStop(1, 'rgba(239,68,68,0.02)');

  dashChartEvolucao = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: '#EF4444',
        backgroundColor: gradient,
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#EF4444',
        pointBorderColor: isDark ? '#27272A' : '#FFFFFF',
        pointBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => fmt(ctx.parsed.y) }
        }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } } },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor, font: { size: 11 },
            callback: (v) => fmt(v)
          }
        }
      }
    }
  });
}

async function loadDashCategorias(signal) {
  try {
    const res = await fetch(API + '/financial/dashboard/categorias?mes=' + dashMonth, { signal });
    const data = await res.json();
    renderDashCategorias(data);
  } catch (e) {
    if (e.name !== 'AbortError') console.error('dashCategorias error:', e);
  }
}

function renderDashCategorias(data) {
  if (dashChartCategorias) dashChartCategorias.destroy();

  const total = data.reduce((s, d) => s + (d.total || 0), 0);
  DOM.dashCatCenter.textContent = fmt(total);

  if (!data.length) {
    DOM.dashCatLegenda.innerHTML = '<span style="color:var(--text-muted);font-size:12px">Sem dados</span>';
    return;
  }

  const ctx = DOM.dashChartCategorias.getContext('2d');
  const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';

  dashChartCategorias = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.nome),
      datasets: [{
        data: data.map(d => d.total),
        backgroundColor: data.map(d => d.cor || '#3F3F46'),
        borderColor: isDark ? '#27272A' : '#FFFFFF',
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => ctx.label + ': ' + fmt(ctx.parsed) }
        }
      }
    }
  });

  DOM.dashCatLegenda.innerHTML = data.map(d =>
    '<span class="dash-cat-legenda-item">' +
    '<span class="dash-cat-legenda-dot" style="background:' + esc(d.cor || '#3F3F46') + '"></span>' +
    esc(d.nome) +
    '</span>'
  ).join('');
}

async function loadDashContas(signal) {
  try {
    const res = await fetch(API + '/financial/dashboard/contas?mes=' + dashMonth, { signal });
    const data = await res.json();
    if (!data.length) {
      DOM.dashContasBody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>Nenhuma conta</p></div></td></tr>';
      return;
    }
    DOM.dashContasBody.innerHTML = data.map(c =>
      '<tr>' +
      '<td>' + esc(c.nome) + '</td>' +
      '<td class="valor-entrada">' + fmt(c.receitas) + '</td>' +
      '<td class="valor-saida">' + fmt(c.despesas) + '</td>' +
      '<td style="' + (c.saldo < 0 ? 'color:var(--color-red)' : '') + '">' + fmt(c.saldo) + '</td>' +
      '<td style="' + (c.previsto < 0 ? 'color:var(--color-red)' : '') + '">' + fmt(c.previsto) + '</td>' +
      '</tr>'
    ).join('');
  } catch (e) {
    if (e.name !== 'AbortError') console.error('dashContas error:', e);
  }
}

async function loadDashAlertas(signal) {
  if (!signal) {
    if (dashController) signal = dashController.signal;
    else { dashController = new AbortController(); signal = dashController.signal; }
  }
  try {
    const res = await fetch(API + '/financial/dashboard/alertas?mes=' + dashMonth + '&tipo=' + dashAlertaTipo, { signal });
    const d = await res.json();
    const tipo = dashAlertaTipo === 'despesa' ? 'despesas' : 'receitas';
    DOM.dashAlertasText.textContent = 'Você tem ' + d.quantidade + ' ' + tipo + ' pendentes no total de ' + fmt(d.total);
  } catch (e) {
    if (e.name !== 'AbortError') console.error('dashAlertas error:', e);
  }
}


// ================================================================
//  DATE RANGE PICKER
// ================================================================

const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Date range filter state — default: current month (timezone-safe)
const _nowInit = new Date();
let drStart = toLocalDateStr(new Date(_nowInit.getFullYear(), _nowInit.getMonth(), 1));
let drEnd   = toLocalDateStr(new Date(_nowInit.getFullYear(), _nowInit.getMonth() + 1, 0));
let drPreset = 'mes';

// Picker internal state
let drTempStart = null, drTempEnd = null;
let drCalStart = { y: _nowInit.getFullYear(), m: _nowInit.getMonth() };
let drCalEnd   = { y: _nowInit.getFullYear(), m: _nowInit.getMonth() };
let drMonthSelYear = _nowInit.getFullYear();
let drClickStep = 0;

// Helpers: toggle calendars vs month selector
function showDrCalendars() {
  DOM.drMonthSel.classList.remove('open');
  document.querySelectorAll('.dr-cal').forEach(c => c.style.display = 'flex');
}
function showDrMonthSel() {
  document.querySelectorAll('.dr-cal').forEach(c => c.style.display = 'none');
  DOM.drMonthSel.classList.add('open');
}

function updateDrLabel() {
  if (!DOM.filterPeriodoLabel) return;
  const names = {
    'hoje': 'Hoje', 'semana': 'Esta semana', 'semana-passada': 'Semana passada',
    'mes': 'Este mês', 'mes-passado': 'Mês passado', 'todos': 'Todos',
    'selecionar-mes': 'Mês selecionado',
  };
  if (drPreset && names[drPreset]) { DOM.filterPeriodoLabel.textContent = names[drPreset]; return; }
  if (drStart && drEnd) DOM.filterPeriodoLabel.textContent = fmtDate(drStart) + ' → ' + fmtDate(drEnd);
  else DOM.filterPeriodoLabel.textContent = 'Período';
}

function openDrPicker() {
  drTempStart = drStart;
  drTempEnd = drEnd;
  drClickStep = drTempStart ? 1 : 0;

  if (drStart) { const d = new Date(drStart + 'T00:00'); drCalStart = { y: d.getFullYear(), m: d.getMonth() }; }
  if (drEnd)   { const d = new Date(drEnd   + 'T00:00'); drCalEnd   = { y: d.getFullYear(), m: d.getMonth() }; }
  if (drCalEnd.y === drCalStart.y && drCalEnd.m === drCalStart.m) {
    drCalEnd = { y: drCalStart.m === 11 ? drCalStart.y + 1 : drCalStart.y, m: (drCalStart.m + 1) % 12 };
  }

  showDrCalendars();
  if (drPreset === 'selecionar-mes') drPreset = 'customizado';
  syncPresetHighlight();
  renderDrCals();
  updateDrRangeDisplay();
  DOM.drOverlay.classList.add('open');
}

function closeDrPicker() { DOM.drOverlay.classList.remove('open'); }
function drOverlayClick(e) { if (e.target === DOM.drOverlay) closeDrPicker(); }

function drNav(which, dir) {
  const cal = which === 'start' ? drCalStart : drCalEnd;
  cal.m += dir;
  if (cal.m > 11) { cal.m = 0; cal.y++; }
  if (cal.m < 0)  { cal.m = 11; cal.y--; }
  renderDrCals();
}

function drYearNav(dir) {
  drMonthSelYear += dir;
  DOM.drMonthYear.textContent = drMonthSelYear;
  renderMonthGrid();
}

function renderDrCals() {
  renderOneCal(DOM.drStartLabel, DOM.drStartDays, drCalStart);
  renderOneCal(DOM.drEndLabel,   DOM.drEndDays,   drCalEnd);
}

function renderOneCal(labelEl, daysEl, cal) {
  labelEl.textContent = MONTHS_PT[cal.m] + ' ' + cal.y;
  const firstDay = new Date(cal.y, cal.m, 1).getDay();
  const daysInMonth = new Date(cal.y, cal.m + 1, 0).getDate();
  const todayStr = today();
  let html = '';

  const prevDays = new Date(cal.y, cal.m, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    html += '<button class="dr-day other-month" disabled><span>' + (prevDays - i) + '</span></button>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = cal.y + '-' + String(cal.m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    let cls = 'dr-day';
    if (ds === todayStr) cls += ' today';
    if (drTempStart && drTempEnd) {
      if (ds === drTempStart) cls += ' range-start';
      else if (ds === drTempEnd) cls += ' range-end';
      else if (ds > drTempStart && ds < drTempEnd) cls += ' in-range';
    } else if (drTempStart && ds === drTempStart) cls += ' range-start range-end';
    html += '<button class="' + cls + '" onclick="drDayClick(\'' + ds + '\')"><span>' + d + '</span></button>';
  }

  const filled = firstDay + daysInMonth;
  const remaining = filled % 7 === 0 ? 0 : 7 - (filled % 7);
  for (let i = 1; i <= remaining; i++) html += '<button class="dr-day other-month" disabled><span>' + i + '</span></button>';
  daysEl.innerHTML = html;
}

function drDayClick(ds) {
  if (drClickStep === 0 || (drTempStart && drTempEnd)) {
    drTempStart = ds; drTempEnd = null; drClickStep = 1;
  } else {
    if (ds < drTempStart) { drTempEnd = drTempStart; drTempStart = ds; }
    else { drTempEnd = ds; }
    drClickStep = 0;
  }
  drPreset = 'customizado';
  syncPresetHighlight();
  renderDrCals();
  updateDrRangeDisplay();
}

function updateDrRangeDisplay() {
  if (!DOM.drRangeDisplay) return;
  if (drTempStart && drTempEnd) DOM.drRangeDisplay.textContent = fmtDate(drTempStart) + '  →  ' + fmtDate(drTempEnd);
  else if (drTempStart) DOM.drRangeDisplay.textContent = fmtDate(drTempStart) + '  →  Selecione a data final';
  else DOM.drRangeDisplay.textContent = 'Selecione o período';
}

function applyDr() {
  if (!drTempStart) { closeDrPicker(); return; }
  drStart = drTempStart;
  drEnd = drTempEnd || drTempStart;
  updateDrLabel();
  closeDrPicker();
  lancPage = 1;
  loadLancamentos();
  loadResumo();
}

function initDrPresets() {
  document.querySelectorAll('.dr-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.preset;
      const now = new Date();

      if (p === 'hoje') {
        drTempStart = drTempEnd = today();
      } else if (p === 'semana') {
        const start = new Date(now); start.setDate(now.getDate() - now.getDay());
        const end = new Date(start); end.setDate(start.getDate() + 6);
        drTempStart = toLocalDateStr(start); drTempEnd = toLocalDateStr(end);
      } else if (p === 'semana-passada') {
        const start = new Date(now); start.setDate(now.getDate() - now.getDay() - 7);
        const end = new Date(start); end.setDate(start.getDate() + 6);
        drTempStart = toLocalDateStr(start); drTempEnd = toLocalDateStr(end);
      } else if (p === 'mes') {
        drTempStart = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
        drTempEnd   = toLocalDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      } else if (p === 'mes-passado') {
        drTempStart = toLocalDateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        drTempEnd   = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 0));
      } else if (p === 'todos') {
        drTempStart = null; drTempEnd = null;
      } else if (p === 'selecionar-mes') {
        drMonthSelYear = now.getFullYear();
        DOM.drMonthYear.textContent = drMonthSelYear;
        showDrMonthSel();
        renderMonthGrid();
        drPreset = p; syncPresetHighlight();
        return;
      } else if (p === 'customizado') {
        showDrCalendars();
      }

      if (p !== 'selecionar-mes') showDrCalendars();
      drPreset = p;
      syncPresetHighlight();
      renderDrCals();
      updateDrRangeDisplay();
    });
  });
}

function syncPresetHighlight() {
  document.querySelectorAll('.dr-preset').forEach(b => b.classList.toggle('active', b.dataset.preset === drPreset));
}

function renderMonthGrid() {
  let html = '';
  MONTHS_PT.forEach((name, idx) => {
    const isActive = drTempStart
      && new Date(drTempStart + 'T00:00').getFullYear() === drMonthSelYear
      && new Date(drTempStart + 'T00:00').getMonth() === idx;
    html += '<button class="dr-month-btn' + (isActive ? ' active' : '') + '" onclick="selectDrMonth(' + idx + ')">' + name.substring(0, 3) + '</button>';
  });
  DOM.drMonthGrid.innerHTML = html;
}

function selectDrMonth(m) {
  drTempStart = toLocalDateStr(new Date(drMonthSelYear, m, 1));
  drTempEnd   = toLocalDateStr(new Date(drMonthSelYear, m + 1, 0));
  drPreset = 'selecionar-mes';
  renderMonthGrid();
  updateDrRangeDisplay();

  drCalStart = { y: drMonthSelYear, m: m };
  drCalEnd = { y: m === 11 ? drMonthSelYear + 1 : drMonthSelYear, m: (m + 1) % 12 };

  showDrCalendars();
  drPreset = 'selecionar-mes';
  syncPresetHighlight();
  renderDrCals();
}


// ================================================================
//  INIT — single entry point
// ================================================================

(function init() {
  cacheDom();
  initTheme();
  initNavigation();
  initDashboard();
  initTabs();
  initFilters();
  initLancamento();
  initCatSelector();
  initTransferencia();
  initContas();
  initCategorias();
  initDrPresets();
  updateDrLabel();
  initPerfilModal();

  // Auth listeners
  DOM.loginBtn.addEventListener('click', handleLogin);
  DOM.loginPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });

  // Theme toggle
  DOM.themeToggleBtn.addEventListener('click', toggleTheme);

  // Start auth check
  checkAuth();
})();