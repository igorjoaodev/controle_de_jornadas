const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// Detecção de ambiente (GitHub Pages / Servidor Local)
let isStaticMode = window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';

const state = {
  month: new Date().toISOString().slice(0, 7),
  units: [],
  unitRecords: [],
  personnel: [],
  operations: [],
  scales: [],
  dashboard: null,
  page: 'dashboard',
  logs: [],
  user: null,
  users: []
};

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
const num = n => Number(n || 0).toLocaleString('pt-BR');

// ==========================================
// BANCO DE DADOS EM NAVEGADOR (MODO GITHUB PAGES)
// ==========================================
const DEFAULT_PERSONNEL = [
  {"name":"SD ALVES","unit":"31ª CIPM","active":1},
  {"name":"SD PECKELHOFF","unit":"31ª CIPM","active":1},
  {"name":"SD FROZ","unit":"31ª CIPM","active":1},
  {"name":"1º SGT DUAYNE","unit":"31ª CIPM","active":1},
  {"name":"SD DA CUNHA","unit":"31ª CIPM","active":1},
  {"name":"SD SILVEIRA","unit":"31ª CIPM","active":1},
  {"name":"3º SGT GERSON","unit":"31ª CIPM","active":1},
  {"name":"SD JOHNNY","unit":"31ª CIPM","active":1},
  {"name":"CB ANDERSON","unit":"31ª CIPM","active":1},
  {"name":"SD KENNEDY","unit":"31ª CIPM","active":1},
  {"name":"SD JOILSON","unit":"31ª CIPM","active":1},
  {"name":"3 SGT AZEVEDO","unit":"31ª CIPM","active":1},
  {"name":"3 SGT E CARDOSO","unit":"31ª CIPM","active":1},
  {"name":"SD YURI","unit":"31ª CIPM","active":1},
  {"name":"SD PEDRO","unit":"31ª CIPM","active":1},
  {"name":"3 SGT FERNANDES","unit":"31ª CIPM","active":1},
  {"name":"SD J. OLIVEIRA","unit":"36º BPM","active":1},
  {"name":"CB E CHAGAS","unit":"36º BPM","active":1},
  {"name":"CB JAYDSON","unit":"36º BPM","active":1},
  {"name":"SD MARCOS","unit":"36º BPM","active":1},
  {"name":"3º SGT COELHO","unit":"17º BPM","active":1},
  {"name":"3° SGT ERNANDES","unit":"17º BPM","active":1},
  {"name":"3º SGT TRINDADE","unit":"17º BPM","active":1},
  {"name":"CEL. AVIZ","unit":"CPR XIII","active":1},
  {"name":"TEN CEL ALAN","unit":"CPR XIII","active":1},
  {"name":"2º TEN ESTEVÃO","unit":"CPR XIII","active":1},
  {"name":"1º SGT ARAÚJO","unit":"CPR XIII","active":1},
  {"name":"2º SGT EDSON ALVES","unit":"CPR XIII","active":1},
  {"name":"3º SGT SÉRGIO","unit":"CPR XIII","active":1},
  {"name":"CB ANDREICK","unit":"CPR XIII","active":1},
  {"name":"CB THIAGO FELIPE","unit":"CPR XIII","active":1}
];

function getLocalStore() {
  const raw = localStorage.getItem('cpr_db_v1');
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  const initial = {
    users: [
      { id: 1, username: 'igor', display_name: 'Igor João', role: 'admin', password: 'igor123', active: 1, created_at: '2026-11-13 14:00:00', last_login: null },
      { id: 2, username: 'andreick', display_name: 'Andreick', role: 'user', password: 'andreick123', active: 1, created_at: '2026-11-13 14:00:00', last_login: null }
    ],
    units: [
      { id: 1, name: 'CPR XIII', active: 1 },
      { id: 2, name: '31ª CIPM', active: 1 },
      { id: 3, name: '17º BPM', active: 1 },
      { id: 4, name: '36º BPM', active: 1 }
    ],
    operations: [
      { id: 1, name: 'OP. PMF', active: 1 },
      { id: 2, name: 'OP. ESC SEG', active: 1 },
      { id: 3, name: 'OP. MST', active: 1 },
      { id: 4, name: 'OP. GERAL CPR XIII', active: 1 }
    ],
    personnel: DEFAULT_PERSONNEL.map((p, i) => ({ id: i + 1, name: p.name, unit: p.unit, active: 1 })),
    quotas: [
      { id: 1, operation_id: 1, month: new Date().toISOString().slice(0, 7), total: 50 },
      { id: 2, operation_id: 2, month: new Date().toISOString().slice(0, 7), total: 50 },
      { id: 3, operation_id: 3, month: new Date().toISOString().slice(0, 7), total: 50 },
      { id: 4, operation_id: 4, month: new Date().toISOString().slice(0, 7), total: 50 }
    ],
    scales: [],
    logs: [
      { id: 1, created_at: new Date().toLocaleString('pt-BR'), client_ip: '127.0.0.1', machine: 'GitHub Pages', method: 'SYSTEM', action: 'INIT', details: 'Banco web inicializado', user_name: 'Sistema' }
    ],
    session: null
  };
  localStorage.setItem('cpr_db_v1', JSON.stringify(initial));
  return initial;
}

function saveLocalStore(db) {
  localStorage.setItem('cpr_db_v1', JSON.stringify(db));
}

function computeLocalDashboard(db, month) {
  const peopleCount = db.personnel.filter(p => p.active).length;
  const activeScales = db.scales.filter(s => s.month === month && s.status !== 'Cancelada');

  const quotas = db.operations.filter(o => o.active).map(o => {
    const q = db.quotas.find(x => x.operation_id === o.id && x.month === month) || { total: 0 };
    const used = activeScales.filter(s => s.operation_id === o.id).length;
    const remaining = q.total - used;
    const over = Math.max(0, -remaining);
    return {
      operation_id: o.id,
      name: o.name,
      total: q.total,
      used,
      remaining,
      over
    };
  });

  const people = db.personnel.filter(p => p.active).map(p => {
    const used = activeScales.filter(s => s.personnel_id === p.id).length;
    return {
      id: p.id,
      name: p.name,
      unit: p.unit,
      used,
      remaining: Math.max(0, 12 - used),
      blocked: used >= 12
    };
  });

  const remainingTotal = quotas.reduce((acc, x) => acc + Math.max(0, x.remaining), 0);
  const overTotal = quotas.reduce((acc, x) => acc + x.over, 0);

  const today = new Date();
  const todayMonth = today.toISOString().slice(0, 7);
  let daysLeft = null;
  if (month === todayMonth) {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    daysLeft = Math.max(0, lastDay.getDate() - today.getDate());
  }

  return {
    month,
    people_count: peopleCount,
    scale_count: activeScales.length,
    quotas,
    people,
    days_left: daysLeft,
    quota_remaining: remainingTotal,
    quota_over: overTotal
  };
}

// Simulador de API em navegador para GitHub Pages
async function localApi(url, opts = {}) {
  const u = new URL(url, 'http://localhost');
  const path = u.pathname;
  const method = (opts.method || 'GET').toUpperCase();
  const body = opts.body ? JSON.parse(opts.body) : {};
  const db = getLocalStore();

  // Rotas públicas
  if (path === '/api/health') {
    return { ok: true, database: 'modo_web_local.db' };
  }

  if (path === '/api/auth/me') {
    if (db.session) {
      const user = db.users.find(x => x.id === db.session.user_id && x.active);
      if (user) {
        return { authenticated: true, user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role } };
      }
    }
    return { authenticated: false };
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const uname = (body.username || '').trim().toLowerCase();
    const pwd = body.password || '';
    const user = db.users.find(x => (x.username.toLowerCase() === uname || x.display_name.toLowerCase() === uname) && x.active);
    if (!user || user.password !== pwd) {
      throw new Error('Usuário ou senha incorretos.');
    }
    user.last_login = new Date().toLocaleString('pt-BR');
    const token = 'token_' + Math.random().toString(36).substring(2);
    db.session = { token, user_id: user.id };
    saveLocalStore(db);
    return {
      ok: true,
      token,
      user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role }
    };
  }

  // Verificação de autenticação para as demais rotas
  if (!db.session) {
    const err = new Error('Não autenticado.');
    err.status = 401;
    throw err;
  }
  const currentUser = db.users.find(x => x.id === db.session.user_id && x.active);
  if (!currentUser) {
    db.session = null;
    saveLocalStore(db);
    const err = new Error('Sessão inválida.');
    err.status = 401;
    throw err;
  }

  // Logout
  if (path === '/api/auth/logout' && method === 'POST') {
    db.session = null;
    saveLocalStore(db);
    return { ok: true };
  }

  // Alterar minha senha
  if (path === '/api/auth/change-password' && method === 'POST') {
    if (currentUser.password !== body.current_password) {
      throw new Error('Senha atual incorreta.');
    }
    if ((body.new_password || '').length < 4) {
      throw new Error('A nova senha deve ter no mínimo 4 caracteres.');
    }
    currentUser.password = body.new_password;
    saveLocalStore(db);
    return { ok: true, message: 'Senha alterada com sucesso.' };
  }

  // Gerenciamento de Usuários (Admin)
  if (path === '/api/auth/users') {
    if (currentUser.role !== 'admin') throw new Error('Acesso negado.');
    if (method === 'GET') {
      return db.users.map(u => ({ id: u.id, username: u.username, display_name: u.display_name, role: u.role, active: u.active, created_at: u.created_at, last_login: u.last_login }));
    }
    if (method === 'POST') {
      const uname = (body.username || '').trim().toLowerCase();
      const dname = (body.display_name || '').trim();
      if (!uname || !dname || (body.password || '').length < 4) {
        throw new Error('Preencha os dados e a senha com ao menos 4 caracteres.');
      }
      if (db.users.some(x => x.username.toLowerCase() === uname)) {
        throw new Error('Já existe um usuário com esse login.');
      }
      const newU = {
        id: (db.users.length ? Math.max(...db.users.map(x => x.id)) : 0) + 1,
        username: uname,
        display_name: dname,
        role: body.role === 'admin' ? 'admin' : 'user',
        password: body.password,
        active: 1,
        created_at: new Date().toLocaleString('pt-BR'),
        last_login: null
      };
      db.users.push(newU);
      saveLocalStore(db);
      return { ok: true, id: newU.id };
    }
  }

  if (path.startsWith('/api/auth/users/')) {
    if (currentUser.role !== 'admin') throw new Error('Acesso negado.');
    const uid = Number(path.rsplit ? path.rsplit('/', 1)[1] : path.split('/').pop());
    const target = db.users.find(x => x.id === uid);
    if (!target) throw new Error('Usuário não encontrado.');

    if (method === 'PATCH') {
      if (body.display_name) target.display_name = body.display_name.trim();
      if (body.role) {
        if (target.id === currentUser.id && body.role !== 'admin') throw new Error('Não é possível remover seu próprio perfil de admin.');
        target.role = body.role;
      }
      if ('active' in body) {
        if (target.id === currentUser.id && body.active === 0) throw new Error('Não é possível inativar seu próprio usuário.');
        target.active = body.active ? 1 : 0;
      }
      if (body.new_password && body.new_password.length >= 4) {
        target.password = body.new_password;
      }
      saveLocalStore(db);
      return { ok: true, message: 'Usuário atualizado.' };
    }
    if (method === 'DELETE') {
      if (target.id === currentUser.id) throw new Error('Não é possível inativar seu próprio usuário.');
      target.active = 0;
      saveLocalStore(db);
      return { ok: true, message: 'Usuário inativado.' };
    }
  }

  // Inits & Dashboards
  const month = u.searchParams.get('month') || new Date().toISOString().slice(0, 7);

  if (path === '/api/init') {
    const scalesWithNames = db.scales.filter(s => s.month === month).map(s => {
      const p = db.personnel.find(x => x.id === s.personnel_id) || { name: 'Desconhecido', unit: '—' };
      const o = db.operations.find(x => x.id === s.operation_id) || { name: 'Desconhecida' };
      return { ...s, person_name: p.name, unit: p.unit, operation_name: o.name };
    }).sort((a, b) => b.scale_date.localeCompare(a.scale_date) || b.id - a.id);

    return {
      units: db.units.filter(u => u.active).map(u => u.name),
      unit_records: db.units,
      month,
      dashboard: computeLocalDashboard(db, month),
      personnel: db.personnel,
      operations: db.operations,
      scales: scalesWithNames,
      user: { id: currentUser.id, username: currentUser.username, display_name: currentUser.display_name, role: currentUser.role }
    };
  }

  if (path === '/api/dashboard') {
    return computeLocalDashboard(db, month);
  }

  // Efetivo
  if (path === '/api/personnel') {
    if (method === 'GET') return db.personnel;
    if (method === 'POST') {
      const name = (body.name || '').trim();
      const unit = (body.unit || '').trim();
      if (!name || !unit) throw new Error('Informe o nome e a unidade.');
      const newP = { id: (db.personnel.length ? Math.max(...db.personnel.map(x => x.id)) : 0) + 1, name, unit, active: 1 };
      db.personnel.push(newP);
      db.logs.unshift({ id: db.logs.length + 1, created_at: new Date().toLocaleString('pt-BR'), client_ip: 'Local', machine: 'Navegador', method: 'POST', action: 'Adicionar Policial', details: `${name} (${unit})`, user_name: currentUser.display_name });
      saveLocalStore(db);
      return { ok: true, id: newP.id };
    }
  }

  if (path.startsWith('/api/personnel/')) {
    const pid = Number(path.split('/').pop());
    const p = db.personnel.find(x => x.id === pid);
    if (!p) throw new Error('Policial não encontrado.');
    if (method === 'PATCH') {
      if (body.name) p.name = body.name.trim();
      if (body.unit) p.unit = body.unit.trim();
      if ('active' in body) p.active = body.active ? 1 : 0;
      saveLocalStore(db);
      return { ok: true };
    }
    if (method === 'DELETE') {
      p.active = 0;
      db.logs.unshift({ id: db.logs.length + 1, created_at: new Date().toLocaleString('pt-BR'), client_ip: 'Local', machine: 'Navegador', method: 'DELETE', action: 'Inativar Policial', details: p.name, user_name: currentUser.display_name });
      saveLocalStore(db);
      return { ok: true };
    }
  }

  // Unidades
  if (path === '/api/units') {
    if (method === 'GET') return db.units;
    if (method === 'POST') {
      const name = (body.name || '').trim();
      if (!name) throw new Error('Informe o nome da unidade.');
      const newU = { id: (db.units.length ? Math.max(...db.units.map(x => x.id)) : 0) + 1, name, active: 1 };
      db.units.push(newU);
      saveLocalStore(db);
      return { ok: true, id: newU.id };
    }
  }

  if (path.startsWith('/api/units/')) {
    const uid = Number(path.split('/').pop());
    const urec = db.units.find(x => x.id === uid);
    if (!urec) throw new Error('Unidade não encontrada.');
    if (method === 'PATCH') {
      const oldName = urec.name;
      urec.name = (body.name || '').trim();
      if (body.name && oldName !== urec.name) {
        db.personnel.forEach(p => { if (p.unit === oldName) p.unit = urec.name; });
      }
      if ('active' in body) urec.active = body.active ? 1 : 0;
      saveLocalStore(db);
      return { ok: true };
    }
    if (method === 'DELETE') {
      urec.active = 0;
      saveLocalStore(db);
      return { ok: true };
    }
  }

  // Operações
  if (path === '/api/operations') {
    if (method === 'GET') return db.operations;
    if (method === 'POST') {
      const name = (body.name || '').trim();
      if (!name) throw new Error('Informe o nome da operação.');
      const newO = { id: (db.operations.length ? Math.max(...db.operations.map(x => x.id)) : 0) + 1, name, active: 1 };
      db.operations.push(newO);
      saveLocalStore(db);
      return { ok: true, id: newO.id };
    }
  }

  if (path.startsWith('/api/operations/')) {
    const oid = Number(path.split('/').pop());
    const orec = db.operations.find(x => x.id === oid);
    if (!orec) throw new Error('Operação não encontrada.');
    if (method === 'PATCH') {
      if (body.name) orec.name = (body.name || '').trim();
      if ('active' in body) orec.active = body.active ? 1 : 0;
      saveLocalStore(db);
      return { ok: true };
    }
    if (method === 'DELETE') {
      orec.active = 0;
      saveLocalStore(db);
      return { ok: true };
    }
  }

  // Cotas
  if (path === '/api/quotas' && method === 'POST') {
    const op = Number(body.operation_id);
    const m = String(body.month || '');
    const tot = Number(body.total);
    if (tot < 0) throw new Error('Cotas inválidas.');
    const existing = db.quotas.find(x => x.operation_id === op && x.month === m);
    if (existing) {
      existing.total = tot;
    } else {
      db.quotas.push({ id: db.quotas.length + 1, operation_id: op, month: m, total: tot });
    }
    saveLocalStore(db);
    return { ok: true };
  }

  // Escalas
  if (path === '/api/scales') {
    if (method === 'POST') {
      const personId = Number(body.personnel_id);
      const opId = Number(body.operation_id);
      const scaleDate = String(body.scale_date || '');
      const notes = String(body.notes || '').trim();
      const m = scaleDate.slice(0, 7);

      const p = db.personnel.find(x => x.id === personId && x.active);
      const o = db.operations.find(x => x.id === opId && x.active);
      if (!p || !o) throw new Error('Policial ou operação inválidos.');

      const count = db.scales.filter(s => s.personnel_id === personId && s.month === m && s.status !== 'Cancelada').length;
      if (count >= 12) throw new Error(`ESCALA BLOQUEADA: ${p.name} já possui ${count} extras em ${m}. O limite é 12 por mês.`);

      const q = db.quotas.find(x => x.operation_id === opId && x.month === m);
      if (!q) throw new Error(`Não há cotas cadastradas para ${o.name} em ${m}. Cadastre antes.`);
      const used = db.scales.filter(s => s.operation_id === opId && s.month === m && s.status !== 'Cancelada').length;
      if (used >= q.total) throw new Error(`COTAS ESGOTADAS: ${o.name} atingiu o limite de ${q.total} cotas.`);

      const newScale = {
        id: (db.scales.length ? Math.max(...db.scales.map(x => x.id)) : 0) + 1,
        personnel_id: personId,
        operation_id: opId,
        scale_date: scaleDate,
        month: m,
        notes,
        status: 'Ativa',
        created_at: new Date().toLocaleString('pt-BR')
      };
      db.scales.push(newScale);
      db.logs.unshift({
        id: db.logs.length + 1,
        created_at: new Date().toLocaleString('pt-BR'),
        client_ip: 'Local',
        machine: 'Navegador',
        method: 'POST',
        action: 'Registrar Escala',
        details: `${p.name} | ${o.name} | ${scaleDate}`,
        user_name: currentUser.display_name
      });
      saveLocalStore(db);
      return { ok: true, id: newScale.id, message: 'Escala registrada com sucesso.' };
    }
  }

  if (path.startsWith('/api/scales/')) {
    const sid = Number(path.split('/').pop());
    const s = db.scales.find(x => x.id === sid);
    if (!s) throw new Error('Escala não encontrada.');
    if (method === 'PATCH') {
      s.status = body.status;
      saveLocalStore(db);
      return { ok: true };
    }
    if (method === 'DELETE') {
      const idx = db.scales.findIndex(x => x.id === sid);
      if (idx !== -1) {
        const deleted = db.scales.splice(idx, 1)[0];
        const p = db.personnel.find(x => x.id === deleted.personnel_id);
        db.logs.unshift({
          id: db.logs.length + 1,
          created_at: new Date().toLocaleString('pt-BR'),
          client_ip: 'Local',
          machine: 'Navegador',
          method: 'DELETE',
          action: 'Excluir Escala',
          details: `ID ${sid} - ${p ? p.name : ''} (${deleted.scale_date})`,
          user_name: currentUser.display_name
        });
        saveLocalStore(db);
      }
      return { ok: true };
    }
  }

  // Logs
  if (path === '/api/logs') {
    if (currentUser.role !== 'admin') throw new Error('Acesso negado.');
    return db.logs;
  }

  throw new Error('Rota não encontrada.');
}

// ==========================================
// CLIENTE HTTP UNIFICADO (HYBRID API)
// ==========================================
async function api(url, opts = {}) {
  if (isStaticMode) {
    return await localApi(url, opts);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const token = localStorage.getItem('cpr_token');
    const headers = {
      'Content-Type': 'application/json',
      'X-Client-Machine': (localStorage.getItem('cpr_machine_name') || 'Estação sem nome')
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const r = await fetch(url, {
      ...opts,
      headers: { ...headers, ...(opts.headers || {}) },
      signal: controller.signal
    });

    let d;
    try { d = await r.json(); } catch { d = { error: 'Resposta inválida do servidor.' }; }

    if (r.status === 401 && url !== '/api/auth/login' && url !== '/api/auth/me') {
      localStorage.removeItem('cpr_token');
      showLogin('Sessão expirada. Por favor, faça login novamente.');
      throw new Error(d.error || 'Não autenticado.');
    }

    if (!r.ok) throw new Error(d.error || `Falha na operação (HTTP ${r.status}).`);
    return d;
  } catch (err) {
    // Se falhar por conexão (ex.: rodando em GitHub Pages sem servidor), ativa modo estático automaticamente
    if (err instanceof TypeError || (err.message && err.message.includes('404'))) {
      console.warn('Servidor Python não detectado. Alternando automaticamente para o Modo Web (GitHub Pages).');
      isStaticMode = true;
      updateStatusBadge();
      return await localApi(url, opts);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function updateStatusBadge() {
  const dot = $('#system-status-dot');
  const title = $('#system-status-title');
  const desc = $('#system-status-desc');
  if (!dot || !title || !desc) return;

  if (isStaticMode) {
    dot.style.background = '#2859cf';
    title.textContent = 'Modo Web (GitHub Pages)';
    desc.textContent = 'Armazenamento local no navegador';
  } else {
    dot.style.background = '#39c58a';
    title.textContent = 'Banco local ativo';
    desc.textContent = 'Conectado ao servidor SQLite';
  }
}

function toast(msg, type = 'success') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  setTimeout(() => el.classList.add('hidden'), 5000);
}

function go(page) {
  state.page = page;
  if (page === 'logs') loadLogs();
  if (page === 'users') loadUsers();
  $$('.page').forEach(x => x.classList.toggle('active', x.id === `page-${page}`));
  $$('.nav').forEach(x => x.classList.toggle('active', x.dataset.page === page));
  const names = {
    dashboard: 'Painel geral',
    scales: 'Escalas e extras',
    personnel: 'Cadastro do efetivo',
    quotas: 'Operações e cotas',
    reports: 'Relatórios mensais',
    logs: 'Logs de alterações',
    users: 'Gerenciamento de Usuários'
  };
  $('#page-title').textContent = names[page] || 'Controle de Extras';
}

function selectOptions(el, items, labelFn, selected) {
  const old = selected ?? el.value;
  el.innerHTML = items.map(x => `<option value="${x.id}">${esc(labelFn(x))}</option>`).join('');
  if (items.some(x => String(x.id) === String(old))) el.value = old;
}

function rankInfo(name) {
  const n = String(name || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(CEL|TEN CEL|MAJ|CAP|TEN|ASP|OFICIAL)\b/.test(n)) return { key: 'oficiais', label: 'OFICIAIS', cls: 'rank-officer' };
  if (/\b(SUB TEN|SUBTEN|1 SGT|2 SGT|3 SGT|SGT|SARGENTO)\b/.test(n)) return { key: 'sargentos', label: 'SARGENTOS', cls: 'rank-sergeant' };
  if (/\b(CB|CABO)\b/.test(n)) return { key: 'cabos', label: 'CABOS', cls: 'rank-cabo' };
  if (/\b(SD|SOLDADO)\b/.test(n)) return { key: 'soldados', label: 'SOLDADOS', cls: 'rank-soldier' };
  return { key: 'outros', label: 'GRADUAÇÃO NÃO IDENTIFICADA', cls: 'rank-other' };
}

function rankTag(name) {
  const r = rankInfo(name);
  return `<span class="rank-tag ${r.cls}">${r.label === 'GRADUAÇÃO NÃO IDENTIFICADA' ? 'GRAD. A CONFERIR' : r.label.slice(0, -1)}</span>`;
}

function unitTag(unit) {
  return `<span class="unit-tag">${esc(unit)}</span>`;
}

function statusBadge(status) {
  if (status === 'Ativa') return '<span class="badge good">● Ativa</span>';
  if (status === 'Concluída') return '<span class="badge neutral">✓ Concluída</span>';
  return '<span class="badge bad">Cancelada</span>';
}

function quotaBadge(q) {
  if (q.over > 0) return `<span class="badge bad">Acima em ${q.over}</span>`;
  if (q.total === 0) return '<span class="badge neutral">Sem cotas definidas</span>';
  if (q.remaining === 0) return '<span class="badge good">Cotas utilizadas</span>';
  return `<span class="badge warn">Faltam ${q.remaining}</span>`;
}

let loadInProgress = null;
async function load() {
  if (loadInProgress) return loadInProgress;
  const requestedMonth = state.month;
  loadInProgress = (async () => {
    try {
      const d = await api(`/api/init?month=${encodeURIComponent(requestedMonth)}`);
      if (requestedMonth !== state.month) return;
      state.units = d.units;
      state.unitRecords = d.unit_records || [];
      state.personnel = d.personnel;
      state.operations = d.operations;
      state.scales = d.scales;
      state.dashboard = d.dashboard;
      if (d.user) applyUser(d.user);
      updateStatusBadge();
      renderAll();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      loadInProgress = null;
    }
  })();
  return loadInProgress;
}

function renderAll() {
  const monthLabel = new Date(`${state.month}-02T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  $('#month-chip').textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  $('#stat-people').textContent = num(state.dashboard.people_count);
  $('#stat-scales').textContent = num(state.dashboard.scale_count);
  $('#stat-remaining').textContent = num(state.dashboard.quota_remaining);
  $('#stat-days').textContent = state.dashboard.days_left === null ? '—' : num(state.dashboard.days_left);
  $('#stat-days-caption').textContent = state.dashboard.days_left === 0 ? 'Último dia do mês' : state.dashboard.days_left === 1 ? 'Dia restante' : 'Dias restantes';

  selectOptions($('#person-unit'), state.units.map(unit => ({ id: unit, name: unit })), x => x.name, 'CPR XIII');
  const activePeople = state.personnel.filter(p => p.active);
  const activeOps = state.operations.filter(o => o.active);
  selectOptions($('#scale-person'), activePeople, p => `${p.name} — ${p.unit}`);
  selectOptions($('#scale-operation'), activeOps, o => o.name);
  selectOptions($('#quota-operation'), activeOps, o => o.name);

  $('#quota-month').value = state.month;

  renderQuotaCards();
  renderAlerts();
  renderLimitTable();
  renderScales();
  renderPeople();
  renderQuotaManagement();
  renderManagement();
  renderReports();
}

function renderQuotaCards() {
  const box = $('#quota-cards');
  if (!state.dashboard.quotas.length) {
    box.innerHTML = '<div class="table-empty">Nenhuma operação cadastrada.</div>';
    return;
  }
  box.innerHTML = state.dashboard.quotas.map(q => {
    const pct = q.total > 0 ? Math.min(100, Math.round(q.used / q.total * 100)) : 0;
    const cls = q.over ? 'full' : q.remaining === 0 && q.total > 0 ? 'full' : pct >= 80 ? 'warn' : '';
    return `<article class="quota-card"><div class="quota-top"><div><div class="quota-name">${esc(q.name)}</div><div class="quota-meta">Cotas do CPR XIII · ${esc(state.month)}</div></div>${quotaBadge(q)}</div><div class="quota-numbers"><strong>${num(q.used)}</strong><span>de ${num(q.total)} utilizadas</span></div><div class="progress"><span class="${cls}" style="width:${pct}%"></span></div><div class="quota-bottom"><span>${pct}% utilizado</span><span>${q.remaining >= 0 ? `${num(q.remaining)} disponíveis` : `${num(q.over)} acima do limite`}</span></div></article>`;
  }).join('');
}

function renderAlerts() {
  const box = $('#alerts');
  const items = [];
  for (const q of state.dashboard.quotas) {
    if (q.total === 0) items.push({ type: 'warning', icon: '⚠', title: `Defina as cotas de ${q.name}`, desc: `Não há quantidade autorizada cadastrada para ${state.month}. O sistema bloqueará escalas até o total ser informado.` });
    else if (q.over > 0) items.push({ type: 'danger', icon: '⛔', title: `Cotas excedidas: ${q.name}`, desc: `Há ${q.over} escala(s) acima do total autorizado. Revise os lançamentos.` });
    else if (q.remaining > 0) {
      const desc = state.dashboard.days_left !== null ? `Faltam distribuir ${q.remaining} cota(s). Restam ${state.dashboard.days_left} dia(s) no mês.` : `Faltam distribuir ${q.remaining} cota(s) neste mês.`;
      items.push({ type: 'warning', icon: '◷', title: `Faltam ${q.remaining} cota(s) — ${q.name}`, desc });
    }
  }
  const near = state.dashboard.people.filter(p => p.used >= 10 && p.used < 12);
  if (near.length) items.push({ type: 'warning', icon: '♙', title: `${near.length} policial(is) próximo(s) do limite`, desc: near.slice(0, 5).map(p => `${p.name} (${p.used}/12)`).join(' · ') + (near.length > 5 ? ' · …' : '') });
  const blocked = state.dashboard.people.filter(p => p.used >= 12);
  if (blocked.length) items.push({ type: 'danger', icon: '⛔', title: `${blocked.length} policial(is) bloqueado(s) para novas extras`, desc: 'Esses policiais atingiram 12 extras no mês. O sistema impedirá novos lançamentos.' });
  if (!items.length) items.push({ type: 'success', icon: '✓', title: 'Nenhum alerta no momento', desc: 'Cadastre as cotas autorizadas por operação e acompanhe o saldo durante o mês.' });
  box.innerHTML = items.map(i => `<div class="alert-item ${i.type}"><div class="alert-symbol">${i.icon}</div><div><strong>${esc(i.title)}</strong><p>${esc(i.desc)}</p></div></div>`).join('');
}

function renderLimitTable() {
  const rows = state.dashboard.people.filter(p => p.used >= 8).sort((a, b) => b.used - a.used || a.name.localeCompare(b.name));
  $('#limit-table').innerHTML = rows.length ? rows.map(p => `<tr><td><span class="person-name">${esc(p.name)}</span><div>${rankTag(p.name)}</div></td><td>${unitTag(p.unit)}</td><td><strong>${p.used}/12</strong></td><td>${p.remaining}</td><td>${p.blocked ? '<span class="badge bad">Bloqueado</span>' : p.used >= 10 ? '<span class="badge warn">Atenção</span>' : '<span class="badge good">Disponível</span>'}</td></tr>`).join('') : '<tr><td colspan="5" class="table-empty">Nenhum policial atingiu 8 extras neste mês.</td>';
}

function renderScales() {
  const q = ($('#scale-search').value || '').toLowerCase();
  const rows = state.scales.filter(s => [s.person_name, s.unit, s.operation_name, s.notes].join(' ').toLowerCase().includes(q));
  $('#scales-table').innerHTML = rows.length ? rows.map(s => `<tr><td>${fmtDate(s.scale_date)}</td><td><span class="person-name">${esc(s.person_name)}</span><div>${rankTag(s.person_name)}</div></td><td>${unitTag(s.unit)}</td><td>${esc(s.operation_name)}</td><td>${statusBadge(s.status)}</td><td>${esc(s.notes || '—')}</td><td><button class="action-btn danger" data-scale-delete="${s.id}">Excluir</button></td></tr>`).join('') : '<tr><td colspan="7" class="table-empty">Nenhuma escala encontrada para este mês.</td>';
}

function renderPeople() {
  const q = ($('#person-search').value || '').toLowerCase();
  const rows = state.personnel.filter(p => [p.name, p.unit].join(' ').toLowerCase().includes(q)).sort((a, b) => {
    const order = { oficiais: 0, sargentos: 1, cabos: 2, soldados: 3, outros: 4 };
    return order[rankInfo(a.name).key] - order[rankInfo(b.name).key] || a.name.localeCompare(b.name);
  });
  const counts = new Map(state.dashboard.people.map(p => [p.id, p]));
  $('#person-count-label').textContent = `${state.personnel.filter(p => p.active).length} policiais ativos cadastrados`;
  $('#person-table').innerHTML = rows.length ? rows.map(p => {
    const st = counts.get(p.id) || { used: 0, remaining: 12, blocked: false };
    return `<tr><td><span class="person-name">${esc(p.name)}</span><div>${rankTag(p.name)}</div></td><td>${unitTag(p.unit)}</td><td><strong>${st.used}/12</strong></td><td>${st.blocked ? '<span class="badge bad">Sem extras disponíveis</span>' : `<span class="badge ${st.remaining <= 2 ? 'warn' : 'good'}">Pode receber ${st.remaining}</span>`}</td><td>${p.active ? '<span class="badge good">Ativo</span>' : '<span class="badge neutral">Inativo</span>'}</td><td>${p.active ? `<button class="action-btn" data-person-edit="${p.id}">Editar</button><button class="action-btn danger" data-person-disable="${p.id}">Inativar</button>` : '<button class="action-btn" data-person-enable="' + p.id + '">Reativar</button>'}</td></tr>`;
  }).join('') : '<tr><td colspan="6" class="table-empty">Nenhum policial encontrado.</td>';
}

function renderQuotaManagement() {
  const box = $('#quota-management');
  box.innerHTML = `<table><thead><tr><th>Operação</th><th>Cotas autorizadas</th><th>Utilizadas</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>${state.dashboard.quotas.map(q => `<tr><td><span class="person-name">${esc(q.name)}</span></td><td>${num(q.total)}</td><td>${num(q.used)}</td><td><strong>${num(q.remaining)}</strong></td><td>${quotaBadge(q)}</td></tr>`).join('')}</tbody></table>`;
}

function renderManagement() {
  $('#operation-management').innerHTML = '<table><thead><tr><th>Operação</th><th>Situação</th><th>Ações</th></tr></thead><tbody>' + state.operations.map(o => `<tr><td><strong>${esc(o.name)}</strong></td><td>${o.active ? '<span class="badge good">Ativa</span>' : '<span class="badge neutral">Inativa</span>'}</td><td><button class="action-btn" data-op-edit="${o.id}">Editar</button>${o.active ? `<button class="action-btn danger" data-op-disable="${o.id}">Inativar</button>` : ''}</td></tr>`).join('') + '</tbody></table>';
  $('#unit-management').innerHTML = '<table><thead><tr><th>Unidade</th><th>Situação</th><th>Policiais ativos</th><th>Ações</th></tr></thead><tbody>' + state.unitRecords.map(u => {
    const n = state.personnel.filter(p => p.unit === u.name && p.active).length;
    return `<tr><td><strong>${esc(u.name)}</strong></td><td>${u.active ? '<span class="badge good">Ativa</span>' : '<span class="badge neutral">Inativa</span>'}</td><td>${n}</td><td><button class="action-btn" data-unit-edit="${u.id}">Editar</button>${u.active ? `<button class="action-btn danger" data-unit-disable="${u.id}">Remover</button>` : ''}</td></tr>`;
  }).join('') + '</tbody></table>';
}

function renderReports() {
  const active = state.scales.filter(s => s.status !== 'Cancelada');
  $('#report-total').textContent = num(active.length);
  $('#report-quota-left').textContent = num(state.dashboard.quota_remaining);
  $('#report-blocked').textContent = num(state.dashboard.people.filter(p => p.used >= 12).length);
  $('#unit-report').innerHTML = state.units.map(unit => {
    const ps = state.dashboard.people.filter(p => p.unit === unit);
    const ids = new Set(ps.map(p => p.id));
    const total = active.filter(s => ids.has(s.personnel_id)).length;
    return `<tr><td>${unitTag(unit)}</td><td>${ps.length}</td><td>${total}</td><td>${ps.filter(p => p.used >= 12).length}</td></tr>`;
  }).join('');
  $('#operation-report').innerHTML = state.dashboard.quotas.map(q => `<tr><td><span class="person-name">${esc(q.name)}</span></td><td>${q.total}</td><td>${q.used}</td><td>${q.remaining}</td><td>${q.total ? Math.round(q.used / q.total * 100) + '%' : '—'}</td></tr>`).join('');
}

function modal(title, body, buttons) {
  $('#modal-content').innerHTML = `<h3>${esc(title)}</h3>${body}<div class="modal-actions">${buttons}</div>`;
  $('#modal').classList.remove('hidden');
}

function closeModal() {
  $('#modal').classList.add('hidden');
}

// ==========================================
// AUTENTICAÇÃO E PERFIL DO USUÁRIO
// ==========================================
function showLogin(errMsg = '') {
  $('#app-shell').classList.add('hidden');
  $('#login-container').classList.remove('hidden');
  const errBox = $('#login-error');
  if (errMsg) {
    errBox.textContent = errMsg;
    errBox.classList.remove('hidden');
  } else {
    errBox.classList.add('hidden');
  }
  $('#login-username').focus();
}

function applyUser(user) {
  state.user = user;
  $('#user-name').textContent = user.display_name;
  const initials = user.display_name.split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  $('#user-avatar').textContent = initials || 'U';

  const badgeEl = $('#user-badge');
  const navUsers = $('#nav-users');
  const navLogs = $('#nav-logs');

  if (user.role === 'admin') {
    badgeEl.textContent = 'DESENVOLVEDOR';
    badgeEl.className = 'badge-role badge-admin';
    if (navUsers) navUsers.classList.remove('hidden');
    if (navLogs) navLogs.classList.remove('hidden');
  } else {
    badgeEl.textContent = 'USUÁRIO NORMAL';
    badgeEl.className = 'badge-role badge-user';
    if (navUsers) navUsers.classList.add('hidden');
    if (navLogs) navLogs.classList.add('hidden');
    if (state.page === 'users' || state.page === 'logs') {
      go('dashboard');
    }
  }
}

async function initAuth() {
  try {
    const d = await api('/api/auth/me');
    if (d && d.authenticated && d.user) {
      applyUser(d.user);
      $('#login-container').classList.add('hidden');
      $('#app-shell').classList.remove('hidden');
      load();
    } else {
      showLogin();
    }
  } catch (err) {
    showLogin();
  }
}

// Formulário de login
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const username = $('#login-username').value.trim();
  const password = $('#login-password').value;
  const btn = $('#login-btn');
  const errBox = $('#login-error');

  errBox.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    const d = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    if (d.token) {
      localStorage.setItem('cpr_token', d.token);
    }
    applyUser(d.user);
    $('#login-password').value = '';
    $('#login-container').classList.add('hidden');
    $('#app-shell').classList.remove('hidden');
    toast(`Bem-vindo, ${d.user.display_name}!`);
    await load();
  } catch (err) {
    errBox.textContent = err.message || 'Usuário ou senha incorretos.';
    errBox.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Acessar sistema</span> →';
  }
});

// Alternar visibilidade da senha no login
$('#toggle-password').addEventListener('click', () => {
  const pwdInput = $('#login-password');
  const isPwd = pwdInput.type === 'password';
  pwdInput.type = isPwd ? 'text' : 'password';
  $('#toggle-password').textContent = isPwd ? '🙈' : '👁';
});

// Logout
$('#btn-logout').addEventListener('click', async () => {
  if (!confirm('Deseja realmente sair do sistema?')) return;
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  localStorage.removeItem('cpr_token');
  state.user = null;
  showLogin('Você saiu do sistema com sucesso.');
});

// Alterar minha própria senha
$('#btn-change-password').addEventListener('click', () => {
  modal('Alterar minha senha', `
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:10px;">
      <label class="field">Senha atual<input id="my-curr-pwd" type="password" required></label>
      <label class="field">Nova senha (mínimo 4 caracteres)<input id="my-new-pwd" type="password" required></label>
      <label class="field">Confirmar nova senha<input id="my-new-pwd2" type="password" required></label>
      <div id="modal-error" class="login-error hidden" style="margin-top:4px;"></div>
    </div>
  `, `
    <button class="btn btn-ghost" id="my-pwd-cancel">Cancelar</button>
    <button class="btn btn-primary" id="my-pwd-save">Salvar nova senha</button>
  `);

  $('#my-pwd-cancel').onclick = closeModal;
  $('#my-pwd-save').onclick = async () => {
    const cur = $('#my-curr-pwd').value;
    const n1 = $('#my-new-pwd').value;
    const n2 = $('#my-new-pwd2').value;
    const errEl = $('#modal-error');
    errEl.classList.add('hidden');

    if (n1 !== n2) {
      errEl.textContent = 'A confirmação não coincide com a nova senha.';
      errEl.classList.remove('hidden');
      return;
    }
    if (n1.length < 4) {
      errEl.textContent = 'A nova senha deve ter pelo menos 4 caracteres.';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: cur, new_password: n1 })
      });
      closeModal();
      toast('Sua senha foi alterada com sucesso!');
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    }
  };
});

// ==========================================
// GERENCIAMENTO DE USUÁRIOS (ADMIN/DEV GERAL)
// ==========================================
async function loadUsers() {
  if (state.user?.role !== 'admin') return;
  try {
    state.users = await api('/api/auth/users');
    renderUsers();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderUsers() {
  const tbody = $('#users-table');
  if (!tbody) return;
  if (!state.users || !state.users.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Nenhum usuário cadastrado.</td></tr>';
    return;
  }
  tbody.innerHTML = state.users.map(u => {
    const roleBadge = u.role === 'admin'
      ? '<span class="badge-role badge-admin">DESENVOLVEDOR (Admin Geral)</span>'
      : '<span class="badge-role badge-user">USUÁRIO NORMAL</span>';
    const statusBadge = u.active
      ? '<span class="badge-status active">● Ativo</span>'
      : '<span class="badge-status inactive">Inativo</span>';
    const isSelf = u.id === state.user.id;

    return `<tr>
      <td><strong>${esc(u.display_name)}</strong> ${isSelf ? '<small style="color:var(--blue);font-weight:700;">(Você)</small>' : ''}</td>
      <td><code>${esc(u.username)}</code></td>
      <td>${roleBadge}</td>
      <td>${statusBadge}</td>
      <td>${u.last_login ? esc(u.last_login) : '<span style="color:#8893a5">Nunca acessou</span>'}</td>
      <td>
        <button class="action-btn" data-user-pwd="${u.id}">Redefinir senha</button>
        <button class="action-btn" data-user-edit="${u.id}">Editar</button>
        ${!isSelf ? (u.active ? `<button class="action-btn danger" data-user-toggle="${u.id}" data-action="0">Inativar</button>` : `<button class="action-btn" data-user-toggle="${u.id}" data-action="1">Reativar</button>`) : ''}
      </td>
    </tr>`;
  }).join('');
}

// Botão Adicionar Usuário
$('#btn-add-user')?.addEventListener('click', () => {
  modal('Cadastrar novo usuário', `
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:10px;">
      <label class="field">Nome completo / Identificação<input id="new-user-dname" placeholder="Ex.: Ten Cel Marcos" required></label>
      <label class="field">Usuário de login (sem espaços)<input id="new-user-uname" placeholder="Ex.: marcos" required></label>
      <label class="field">Perfil de acesso
        <select id="new-user-role">
          <option value="user">Usuário Normal (Lançamentos e relatórios)</option>
          <option value="admin">Desenvolvedor / Administrador Geral (Acesso total)</option>
        </select>
      </label>
      <label class="field">Senha inicial (mínimo 4 caracteres)<input id="new-user-pwd" type="password" required></label>
      <div id="modal-error" class="login-error hidden"></div>
    </div>
  `, `
    <button class="btn btn-ghost" id="add-user-cancel">Cancelar</button>
    <button class="btn btn-primary" id="add-user-save">Criar usuário</button>
  `);

  $('#add-user-cancel').onclick = closeModal;
  $('#add-user-save').onclick = async () => {
    const dname = $('#new-user-dname').value.trim();
    const uname = $('#new-user-uname').value.trim();
    const role = $('#new-user-role').value;
    const pwd = $('#new-user-pwd').value;
    const errEl = $('#modal-error');
    errEl.classList.add('hidden');

    if (!dname || !uname || pwd.length < 4) {
      errEl.textContent = 'Preencha todos os campos. A senha deve ter ao menos 4 caracteres.';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      await api('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify({ display_name: dname, username: uname, role, password: pwd })
      });
      closeModal();
      toast('Novo usuário criado com sucesso!');
      await loadUsers();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    }
  };
});

// Ações na tabela de usuários
document.addEventListener('click', async e => {
  const btnPwd = e.target.closest('[data-user-pwd]');
  const btnEdit = e.target.closest('[data-user-edit]');
  const btnToggle = e.target.closest('[data-user-toggle]');

  if (btnPwd) {
    const uid = Number(btnPwd.dataset.userPwd);
    const u = state.users.find(x => x.id === uid);
    if (!u) return;

    modal(`Redefinir senha de ${u.display_name}`, `
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:10px;">
        <p style="font-size:12px;color:var(--muted);margin:0;">Defina uma nova senha para o usuário <strong>${esc(u.username)}</strong>.</p>
        <label class="field">Nova senha<input id="reset-pwd-val" type="password" required></label>
        <div id="modal-error" class="login-error hidden"></div>
      </div>
    `, `
      <button class="btn btn-ghost" id="reset-pwd-cancel">Cancelar</button>
      <button class="btn btn-primary" id="reset-pwd-save">Salvar nova senha</button>
    `);

    $('#reset-pwd-cancel').onclick = closeModal;
    $('#reset-pwd-save').onclick = async () => {
      const p = $('#reset-pwd-val').value;
      const errEl = $('#modal-error');
      if (p.length < 4) {
        errEl.textContent = 'A senha deve ter pelo menos 4 caracteres.';
        errEl.classList.remove('hidden');
        return;
      }
      try {
        await api(`/api/auth/users/${uid}`, {
          method: 'PATCH',
          body: JSON.stringify({ new_password: p })
        });
        closeModal();
        toast(`Senha de ${u.display_name} redefinida.`);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    };
  } else if (btnEdit) {
    const uid = Number(btnEdit.dataset.userEdit);
    const u = state.users.find(x => x.id === uid);
    if (!u) return;

    modal(`Editar usuário: ${u.display_name}`, `
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:10px;">
        <label class="field">Nome completo / Identificação<input id="edit-user-dname" value="${esc(u.display_name)}" required></label>
        <label class="field">Perfil de acesso
          <select id="edit-user-role">
            <option value="user" ${u.role === 'user' ? 'selected' : ''}>Usuário Normal</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Desenvolvedor / Administrador Geral</option>
          </select>
        </label>
        <div id="modal-error" class="login-error hidden"></div>
      </div>
    `, `
      <button class="btn btn-ghost" id="edit-user-cancel">Cancelar</button>
      <button class="btn btn-primary" id="edit-user-save">Salvar alterações</button>
    `);

    $('#edit-user-cancel').onclick = closeModal;
    $('#edit-user-save').onclick = async () => {
      const dname = $('#edit-user-dname').value.trim();
      const role = $('#edit-user-role').value;
      const errEl = $('#modal-error');
      if (!dname) {
        errEl.textContent = 'Informe o nome.';
        errEl.classList.remove('hidden');
        return;
      }
      try {
        await api(`/api/auth/users/${uid}`, {
          method: 'PATCH',
          body: JSON.stringify({ display_name: dname, role })
        });
        closeModal();
        toast('Usuário atualizado com sucesso.');
        await loadUsers();
        if (uid === state.user.id) {
          state.user.display_name = dname;
          state.user.role = role;
          applyUser(state.user);
        }
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    };
  } else if (btnToggle) {
    const uid = Number(btnToggle.dataset.userToggle);
    const act = Number(btnToggle.dataset.action);
    const u = state.users.find(x => x.id === uid);
    if (!u) return;
    const msg = act === 1 ? `Reativar o acesso de ${u.display_name}?` : `Inativar ${u.display_name}? O usuário não conseguirá mais efetuar login.`;
    if (!confirm(msg)) return;
    try {
      await api(`/api/auth/users/${uid}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: act })
      });
      toast(act === 1 ? 'Usuário reativado.' : 'Usuário inativado.');
      await loadUsers();
    } catch (err) {
      toast(err.message, 'error');
    }
  }
});

// ==========================================
// AUDITORIA E LOGS
// ==========================================
async function loadLogs() {
  if (state.user?.role !== 'admin') return;
  try {
    state.logs = await api('/api/logs');
    renderLogs();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderLogs() {
  const q = ($('#logs-search')?.value || '').toLowerCase();
  const rows = (state.logs || []).filter(x => [x.created_at, x.user_name, x.client_ip, x.machine, x.action, x.details, x.method].join(' ').toLowerCase().includes(q));
  $('#logs-table').innerHTML = rows.length ? rows.map(x => `<tr>
    <td>${esc(x.created_at)}</td>
    <td><strong>${esc(x.user_name || '—')}</strong></td>
    <td>${esc(x.machine)}</td>
    <td><code>${esc(x.client_ip)}</code></td>
    <td><strong>${esc(x.action)}</strong></td>
    <td class="log-detail">${esc(x.details || '—')}</td>
  </tr>`).join('') : '<tr><td colspan="6" class="table-empty">Nenhum registro encontrado.</td></tr>';
}

$('#logs-search')?.addEventListener('input', renderLogs);
$('#machine-name-btn')?.addEventListener('click', () => {
  const current = localStorage.getItem('cpr_machine_name') || '';
  const value = prompt('Informe um nome para identificar este computador nos logs (ex.: PERMANÊNCIA-01):', current);
  if (value === null) return;
  localStorage.setItem('cpr_machine_name', value.trim() || 'Estação sem nome');
  toast('Nome desta estação atualizado.');
});

// ==========================================
// EXPORTAÇÃO CSV HÍBRIDA (SERVIDOR OU NAVEGADOR)
// ==========================================
$('#export-link')?.addEventListener('click', e => {
  if (isStaticMode) {
    e.preventDefault();
    const active = state.scales.filter(s => s.status !== 'Cancelada');
    let csv = '\ufeffData;Mês;Policial;Unidade de origem;Operação;Situação;Observações\r\n';
    active.forEach(s => {
      csv += `${s.scale_date};${s.month};"${s.person_name}";"${s.unit}";"${s.operation_name}";"${s.status}";"${s.notes || ''}"\r\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `extras_${state.month}.csv`;
    a.click();
    URL.revokeObjectURL(u);
    toast('Relatório CSV exportado com sucesso!');
  }
});

// ==========================================
// EVENTOS PRINCIPAIS DE NAVEGAÇÃO E CRUD
// ==========================================
$$('.nav').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
$$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
$('#modal-close').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
$('#refresh-btn').addEventListener('click', load);

$('#month-picker').value = state.month;
$('#month-picker').addEventListener('change', e => {
  if (e.target.value) {
    state.month = e.target.value;
    $('#quota-month').value = state.month;
    load();
  }
});

$('#scale-date').value = new Date().toISOString().slice(0, 10);
$('#scale-date').addEventListener('change', e => {
  if (e.target.value) {
    const m = e.target.value.slice(0, 7);
    if (m !== state.month) {
      state.month = m;
      $('#month-picker').value = m;
      $('#quota-month').value = m;
      load();
    }
  }
});

$('#scale-form').addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {
    personnel_id: Number($('#scale-person').value),
    operation_id: Number($('#scale-operation').value),
    scale_date: $('#scale-date').value,
    notes: $('#scale-notes').value
  };
  try {
    const r = await api('/api/scales', { method: 'POST', body: JSON.stringify(payload) });
    $('#scale-notes').value = '';
    toast(r.message || 'Escala registrada.');
    await load();
    go('scales');
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#person-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/api/personnel', { method: 'POST', body: JSON.stringify({ name: $('#person-name').value, unit: $('#person-unit').value }) });
    $('#person-name').value = '';
    toast('Policial cadastrado.');
    await load();
    go('personnel');
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#unit-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/api/units', { method: 'POST', body: JSON.stringify({ name: $('#unit-name').value }) });
    $('#unit-name').value = '';
    toast('Unidade cadastrada.');
    await load();
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#operation-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/api/operations', { method: 'POST', body: JSON.stringify({ name: $('#operation-name').value }) });
    $('#operation-name').value = '';
    toast('Operação cadastrada. Agora defina as cotas do mês.');
    await load();
    go('quotas');
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#quota-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/api/quotas', { method: 'POST', body: JSON.stringify({ operation_id: Number($('#quota-operation').value), month: $('#quota-month').value, total: Number($('#quota-total').value) }) });
    state.month = $('#quota-month').value;
    $('#month-picker').value = state.month;
    toast('Quantidade de cotas salva.');
    await load();
    go('quotas');
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#scale-search').addEventListener('input', renderScales);
$('#person-search').addEventListener('input', renderPeople);

document.addEventListener('click', async e => {
  const cancel = e.target.closest('[data-scale-delete]');
  const edit = e.target.closest('[data-person-edit]');
  const disable = e.target.closest('[data-person-disable]');
  const enable = e.target.closest('[data-person-enable]');
  const opEdit = e.target.closest('[data-op-edit]');
  const opDisable = e.target.closest('[data-op-disable]');
  const unitEdit = e.target.closest('[data-unit-edit]');
  const unitDisable = e.target.closest('[data-unit-disable]');

  try {
    if (cancel) {
      if (!confirm('Excluir definitivamente este lançamento? A cota será liberada. A ação ficará registrada nos Logs.')) return;
      await api(`/api/scales/${cancel.dataset.scaleDelete}`, { method: 'DELETE' });
      toast('Lançamento excluído e cota liberada.');
      await load();
      if (state.page === 'logs') loadLogs();
    } else if (edit) {
      const p = state.personnel.find(x => x.id === Number(edit.dataset.personEdit));
      modal('Editar policial', `<label class="field">Nome<input id="edit-name" value="${esc(p.name)}" maxlength="100"></label><label class="field" style="margin-top:12px">Unidade<select id="edit-unit">${state.units.map(u => `<option ${u === p.unit ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label>`, `<button class="btn btn-ghost" id="edit-cancel">Cancelar</button><button class="btn btn-primary" id="edit-save">Salvar</button>`);
      $('#edit-cancel').onclick = closeModal;
      $('#edit-save').onclick = async () => {
        try {
          await api(`/api/personnel/${p.id}`, { method: 'PATCH', body: JSON.stringify({ name: $('#edit-name').value, unit: $('#edit-unit').value, active: !!p.active }) });
          closeModal();
          toast('Cadastro atualizado.');
          await load();
        } catch (err) {
          toast(err.message, 'error');
        }
      };
    } else if (disable) {
      if (!confirm('Inativar este policial? O histórico de escalas será preservado.')) return;
      await api(`/api/personnel/${disable.dataset.personDisable}`, { method: 'DELETE' });
      toast('Policial inativado.');
      await load();
    } else if (enable) {
      const p = state.personnel.find(x => x.id === Number(enable.dataset.personEnable));
      await api(`/api/personnel/${p.id}`, { method: 'PATCH', body: JSON.stringify({ name: p.name, unit: p.unit, active: true }) });
      toast('Policial reativado.');
      await load();
    } else if (opEdit) {
      const o = state.operations.find(x => x.id === Number(opEdit.dataset.opEdit));
      modal('Editar operação', `<label class="field">Nome da operação<input id="edit-op-name" value="${esc(o.name)}"></label>`, `<button class="btn btn-ghost" id="edit-cancel">Cancelar</button><button class="btn btn-primary" id="edit-save">Salvar</button>`);
      $('#edit-cancel').onclick = closeModal;
      $('#edit-save').onclick = async () => {
        try {
          await api(`/api/operations/${o.id}`, { method: 'PATCH', body: JSON.stringify({ name: $('#edit-op-name').value, active: !!o.active }) });
          closeModal();
          toast('Operação atualizada.');
          await load();
        } catch (err) {
          toast(err.message, 'error');
        }
      };
    } else if (opDisable) {
      if (!confirm('Inativar operação? O histórico e as cotas serão preservados.')) return;
      await api(`/api/operations/${opDisable.dataset.opDisable}`, { method: 'DELETE' });
      toast('Operação inativada.');
      await load();
    } else if (unitEdit) {
      const u = state.unitRecords.find(x => x.id === Number(unitEdit.dataset.unitEdit));
      modal('Editar unidade', `<label class="field">Nome da unidade<input id="edit-unit-name" value="${esc(u.name)}"></label>`, `<button class="btn btn-ghost" id="edit-cancel">Cancelar</button><button class="btn btn-primary" id="edit-save">Salvar</button>`);
      $('#edit-cancel').onclick = closeModal;
      $('#edit-save').onclick = async () => {
        try {
          await api(`/api/units/${u.id}`, { method: 'PATCH', body: JSON.stringify({ name: $('#edit-unit-name').value, active: !!u.active }) });
          closeModal();
          toast('Unidade atualizada; efetivo vinculado atualizado também.');
          await load();
        } catch (err) {
          toast(err.message, 'error');
        }
      };
    } else if (unitDisable) {
      if (!confirm('Remover unidade? É necessário não haver policiais ativos vinculados.')) return;
      await api(`/api/units/${unitDisable.dataset.unitDisable}`, { method: 'DELETE' });
      toast('Unidade removida da lista ativa.');
      await load();
    }
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#quota-month').addEventListener('change', e => {
  if (e.target.value) $('#month-picker').value = e.target.value;
});

// Inicialização
initAuth();
