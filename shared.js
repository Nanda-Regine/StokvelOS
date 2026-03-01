// ============================================================
// StokvelOS — Shared Data Layer + Utilities
// ============================================================

const OPENAI_KEY = ''; // Set your OPENAI_API_KEY here

// ── Storage helpers ──────────────────────────────────────────
const DB = {
  get: (key, fallback = null) => {
    try { const v = localStorage.getItem(`sos_${key}`); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set: (key, value) => {
    try { localStorage.setItem(`sos_${key}`, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  del: (key) => localStorage.removeItem(`sos_${key}`),
};

// ── ID generator ─────────────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── Date helpers ─────────────────────────────────────────────
const fmt = {
  date: (d) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }),
  dateShort: (d) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
  month: (d) => new Date(d).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }),
  currency: (n) => `R${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
};

// ── Stokvel Config ────────────────────────────────────────────
const Config = {
  get: () => DB.get('config'),
  set: (v) => DB.set('config', v),
  isSetup: () => !!DB.get('config'),
};

// ── Members ───────────────────────────────────────────────────
const Members = {
  all: () => DB.get('members', []),
  get: (id) => Members.all().find(m => m.id === id),
  save: (list) => DB.set('members', list),
  add: (member) => {
    const list = Members.all();
    const newMember = { id: uid(), ...member, status: 'active', joinedAt: new Date().toISOString() };
    list.push(newMember);
    Members.save(list);
    return newMember;
  },
  update: (id, patch) => {
    const list = Members.all().map(m => m.id === id ? { ...m, ...patch } : m);
    Members.save(list);
  },
  remove: (id) => Members.save(Members.all().filter(m => m.id !== id)),
};

// ── Contributions ─────────────────────────────────────────────
const Contributions = {
  all: () => DB.get('contributions', []),
  save: (list) => DB.set('contributions', list),
  add: (contrib) => {
    const list = Contributions.all();
    const item = { id: uid(), ...contrib, recordedAt: new Date().toISOString() };
    list.push(item);
    Contributions.save(list);
    return item;
  },
  forMember: (memberId) => Contributions.all().filter(c => c.memberId === memberId),
  currentMonth: () => {
    const now = new Date();
    return Contributions.all().filter(c => {
      const d = new Date(c.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  },
  potTotal: () => Contributions.all()
    .filter(c => c.status === 'confirmed')
    .reduce((sum, c) => sum + Number(c.amount), 0),
};

// ── Meetings ──────────────────────────────────────────────────
const Meetings = {
  all: () => DB.get('meetings', []),
  save: (list) => DB.set('meetings', list),
  add: (meeting) => {
    const list = Meetings.all();
    const item = { id: uid(), ...meeting, createdAt: new Date().toISOString() };
    list.push(item);
    Meetings.save(list);
    return item;
  },
  update: (id, patch) => {
    const list = Meetings.all().map(m => m.id === id ? { ...m, ...patch } : m);
    Meetings.save(list);
  },
};

// ── AI Call ───────────────────────────────────────────────────
async function callAI(systemPrompt, userMessage, maxTokens = 300) {
  if (!OPENAI_KEY) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });
    const json = await res.json();
    return json.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

// ── Next payout member ────────────────────────────────────────
function nextPayoutMember() {
  const members = Members.all().filter(m => m.status === 'active');
  if (!members.length) return null;
  members.sort((a, b) => (a.payoutPosition || 99) - (b.payoutPosition || 99));
  return members[0];
}

// ── Payment status for current month ─────────────────────────
function memberPaymentStatus(memberId) {
  const current = Contributions.currentMonth();
  const paid = current.find(c => c.memberId === memberId && c.status === 'confirmed');
  if (paid) return 'paid';
  const pending = current.find(c => c.memberId === memberId && c.status === 'pending');
  if (pending) return 'pending';
  // Check if overdue (past 5th of month)
  const today = new Date();
  if (today.getDate() > 5) return 'late';
  return 'outstanding';
}

// ── Redirect to setup if not configured ──────────────────────
function requireSetup() {
  if (!Config.isSetup() && !window.location.pathname.includes('setup')) {
    window.location.href = 'setup.html';
  }
}

// ── Active nav highlight ──────────────────────────────────────
function highlightNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(el => {
    if (el.getAttribute('href') === page) el.classList.add('active');
  });
}

// ── Shared nav HTML ───────────────────────────────────────────
function renderNav() {
  const cfg = Config.get();
  const name = cfg?.name || 'StokvelOS';
  return `
  <nav class="sidebar">
    <div class="sidebar-brand">
      <div class="brand-icon">S</div>
      <div class="brand-text">
        <span class="brand-name">${name}</span>
        <span class="brand-sub">StokvelOS</span>
      </div>
    </div>
    <ul class="nav-list">
      <li><a href="index.html" class="nav-link"><span class="nav-icon">◈</span> Dashboard</a></li>
      <li><a href="members.html" class="nav-link"><span class="nav-icon">◉</span> Members</a></li>
      <li><a href="contributions.html" class="nav-link"><span class="nav-icon">◎</span> Contributions</a></li>
      <li><a href="meetings.html" class="nav-link"><span class="nav-icon">◍</span> Meetings</a></li>
      <li><a href="reports.html" class="nav-link"><span class="nav-icon">◐</span> Reports</a></li>
    </ul>
    <div class="sidebar-footer">
      <div class="sidebar-footer-text">Built by Nanda Regine</div>
      <div class="sidebar-footer-sub"><a href="https://mirembemuse.co.za" target="_blank">mirembemuse.co.za</a></div>
    </div>
  </nav>`;
}

// ── Page shell ────────────────────────────────────────────────
function pageShell(title, content) {
  return `
  <div class="app-layout">
    ${renderNav()}
    <main class="main-content">
      <div class="page-header">
        <h1 class="page-title">${title}</h1>
      </div>
      <div class="page-body">${content}</div>
    </main>
  </div>`;
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
}
