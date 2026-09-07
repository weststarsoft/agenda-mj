/* =====================================================================
   Agenda Mailza 11 — Vale do Juruá
   Dados no Supabase. Leitura pública, escrita só para a coordenação.
   Funciona offline com o que foi lido da última vez.
   ===================================================================== */
'use strict';

const CFG = window.AGENDA_CONFIG || {};
const CACHE_KEY = 'agenda:cache:v1';
const OUTBOX_KEY = 'agenda:outbox:v1';

let sb = null;
try {
  if (CFG.supabaseUrl && !/SEU-PROJETO/.test(CFG.supabaseUrl) && window.supabase) {
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
} catch (e) { sb = null; }

/* ---------------- armazenamento local, sempre protegido ---------------- */
const mem = {};
const local = {
  get(k) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : (mem[k] ?? null); }
    catch (e) { return mem[k] ?? null; }
  },
  set(k, v) {
    mem[k] = v;
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* modo privado */ }
  }
};

/* ---------------- tipos, grupos, comitivas ---------------- */
const GROUPS = {
  rua:       { label: 'Rua',       color: '#E83181' },
  reuniao:   { label: 'Reuniões',  color: '#5FC1EE' },
  midia:     { label: 'Mídia',     color: '#0095DB' },
  logistica: { label: 'Logística', color: '#7E93C4' }
};

const TYPES = {
  carreata:     { label: 'Carreata',           group: 'rua' },
  caminhada:    { label: 'Caminhada',          group: 'rua' },
  bandeiraco:   { label: 'Bandeiraço',         group: 'rua' },
  comicio:      { label: 'Comício',            group: 'rua' },
  comercio:     { label: 'Visita ao comércio', group: 'rua' },
  reuniao:      { label: 'Reunião',            group: 'reuniao' },
  recepcao:     { label: 'Recepção',           group: 'reuniao' },
  comunidade:   { label: 'Comunidade',         group: 'reuniao' },
  podcast:      { label: 'Podcast',            group: 'midia' },
  entrevista:   { label: 'Entrevista',         group: 'midia' },
  radio:        { label: 'Rádio',              group: 'midia' },
  deslocamento: { label: 'Deslocamento',       group: 'logistica' },
  refeicao:     { label: 'Refeição',           group: 'logistica' },
  hotel:        { label: 'Hotel',              group: 'logistica' }
};

const WHO = {
  majoritario: { label: 'Majoritário' },
  bittar:      { label: 'Sen. Márcio Bittar' },
  jessica:     { label: 'Jéssica Sales' }
};

/* ---------------- ícones ---------------- */
const S = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  carreata: `<svg viewBox="0 0 24 24" width="21" height="21" ${S}><path d="M3 14.5h18"/><path d="M4.5 14.5 6 8.8A2 2 0 0 1 7.9 7.3h8.2A2 2 0 0 1 18 8.8l1.5 5.7"/><path d="M3 14.5v3.2h18v-3.2"/><circle cx="7" cy="18" r="1.7"/><circle cx="17" cy="18" r="1.7"/></svg>`,
  caminhada: `<svg viewBox="0 0 24 24" width="21" height="21" ${S}><circle cx="13" cy="4.3" r="1.9"/><path d="M13.2 8.2 10 10.6l1.4 3.2"/><path d="m11.4 13.8-2.6 3.4L7 21"/><path d="m11.4 13.8 3 1.6.9 5.6"/><path d="m13.6 8.6 3.2 2.1 2.2-.6"/></svg>`,
  bandeiraco: `<svg viewBox="0 0 24 24" width="21" height="21" ${S}><path d="M6 21V3"/><path d="M6 4h11.5l-2.2 4.2L17.5 12H6"/></svg>`,
  comicio: `<svg viewBox="0 0 24 24" width="21" height="21" ${S}><path d="M4 10.2 17 5v11l-13-4.2z"/><path d="M4 10.2H3.2A1.2 1.2 0 0 0 2 11.4v.6a1.2 1.2 0 0 0 1.2 1.2H4"/><path d="M17 8.5a2.6 2.6 0 0 1 0 4"/><path d="M7.4 12.6 8.6 20"/></svg>`,
  comercio: `<svg viewBox="0 0 24 24" width="21" height="21" ${S}><path d="M3.5 9.5h17V20h-17z"/><path d="M3 9.5 5 4.4h14l2 5.1"/><path d="M9 20v-5.4h6V20"/></svg>`,
  reuniao: `<svg viewBox="0 0 24 24" width="21" height="21" ${S}><circle cx="9" cy="8" r="2.6"/><circle cx="16.6" cy="9.2" r="2.1"/><path d="M3.6 18.6a5.6 5.6 0 0 1 10.8 0"/><path d="M15.5 13.8a4.6 4.6 0 0 1 4.9 4.3"/></svg>`,
  recepcao: `<svg viewBox="0 0 24 24" width="21" height="21" ${S}><path d="M12 3v9"/><path d="m8.4 8.6 3.6 3.6 3.6-3.6"/><path d="M4 14.4v3.4a2.4 2.4 0 0 0 2.4 2.4h11.2a2.4 2.4 0 0 0 2.4-2.4v-3.4"/></svg>`,
  comunidade: `<svg viewBox="0 0 24 24" width="21" height="21" ${S}><path d="M3.4 12.6 8 8.6l4.6 4"/><path d="M5 12v7.6h6V12"/><path d="M13.6 19.6H19a1.4 1.4 0 0 0 1.4-1.4v-5.4l-3.6-3.2-2.6 2.3"/><path d="M17 5V3.4"/></svg>`,
  podcast: `<svg viewBox="0 0 24 24" width="21" height="21" ${S}><rect x="9.4" y="2.8" width="5.2" height="9.6" rx="2.6"/><path d="M6.4 11a5.6 5.6 0 0 0 11.2 0"/><path d="M12 16.6V21"/><path d="M8.6 21h6.8"/></svg>`,
  entrevista: `<svg viewBox="0 0 24 24" width="21" height="21" ${S}><rect x="2.8" y="4.4" width="18.4" height="12" rx="2"/><path d="M8.5 20h7"/><path d="M12 16.4V20"/><path d="M9.6 10.4h4.8"/></svg>`,
  radio: `<svg viewBox="0 0 24 24" width="21" height="21" ${S}><circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4"/><path d="M16.2 16.2a6 6 0 0 0 0-8.4"/><path d="M4.9 4.9a10 10 0 0 0 0 14.2"/><path d="M19.1 19.1a10 10 0 0 0 0-14.2"/></svg>`,
  deslocamento: `<svg viewBox="0 0 24 24" width="21" height="21" ${S}><circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.4 6h4.2a3 3 0 0 1 0 6H9.6a3 3 0 0 0 0 6h6"/></svg>`,
  refeicao: `<svg viewBox="0 0 24 24" width="21" height="21" ${S}><path d="M7 3v7.4a2.2 2.2 0 0 0 4.4 0V3"/><path d="M9.2 12.6V21"/><path d="M16.4 21v-7.6a3.4 3.4 0 0 1 0-6.6V3"/></svg>`,
  hotel: `<svg viewBox="0 0 24 24" width="21" height="21" ${S}><path d="M3 18v-6.6h13.6A4.4 4.4 0 0 1 21 15.8V18"/><path d="M3 8v10"/><path d="M21 18v1.6"/><circle cx="7.4" cy="9" r="1.8"/></svg>`
};
const ICON_PIN = `<svg viewBox="0 0 24 24" width="15" height="15" ${S}><path d="M12 21s6.4-6 6.4-10.6A6.4 6.4 0 0 0 5.6 10.4C5.6 15 12 21 12 21z"/><circle cx="12" cy="10.2" r="2.2"/></svg>`;
const ICON_WARN = `<svg viewBox="0 0 24 24" width="14" height="14" ${S}><path d="M12 4.5 3.5 19.5h17z"/><path d="M12 10v4"/><path d="M12 16.8h.01"/></svg>`;
const ICON_CANCEL = `<svg viewBox="0 0 24 24" width="12" height="12" ${S}><circle cx="12" cy="12" r="8.4"/><path d="m8.6 8.6 6.8 6.8"/></svg>`;

/* ---------------- estado ---------------- */
let EVENTS = [];
let selectedDate = null;
let activeGroups = new Set();
let query = '';
let session = null;
let editingId = null;
let pendingDelete = null;
let lastSync = null;

const PERIOD_LABEL = { dia: 'Dia', manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
const PERIOD_SORT  = { dia: '07:59', manha: '08:00', tarde: '13:59', noite: '18:59' };
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WD_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MONTH = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseISO(iso) { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, m - 1, d); }
function sortKey(e) { return e.time || PERIOD_SORT[e.period] || '23:58'; }
function byTime(a, b) { return sortKey(a).localeCompare(sortKey(b)) || String(a.title).localeCompare(String(b.title)); }
function locString(e) { return [e.place, e.city, 'AC', 'Brasil'].filter(Boolean).join(', '); }
function mapsUrl(e) {
  return (e.lat && e.lng)
    ? `https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locString(e))}`;
}
function wazeUrl(e) {
  return (e.lat && e.lng)
    ? `https://waze.com/ul?ll=${e.lat},${e.lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(locString(e))}&navigate=yes`;
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2600);
}
function banner(msg, tone) {
  const b = $('#banner');
  if (!msg) { b.hidden = true; return; }
  b.hidden = false; b.textContent = msg;
  b.className = 'banner' + (tone ? ' ' + tone : '');
}

/* ---------------- tradução banco <-> app ---------------- */
function fromRow(r) {
  return {
    id: r.id,
    date: r.event_date,
    time: r.event_time || '',
    period: r.period || '',
    type: TYPES[r.kind] ? r.kind : 'reuniao',
    title: r.title || '',
    desc: r.description || '',
    place: r.place || '',
    city: r.city || '',
    lat: r.lat ?? '',
    lng: r.lng ?? '',
    who: WHO[r.entourage] ? r.entourage : 'majoritario',
    resp: r.responsible || '',
    part: r.participants || '',
    simul: r.simultaneous || '',
    pending: !!r.location_pending,
    status: r.status === 'cancelada' ? 'cancelada' : '',
    cancelNote: r.cancel_note || '',
    updatedAt: r.updated_at || null,
    updatedBy: r.updated_by || ''
  };
}
function toRow(e) {
  return {
    id: e.id,
    event_date: e.date,
    event_time: e.time || null,
    period: e.time ? null : (e.period || 'dia'),
    kind: e.type,
    title: e.title,
    description: e.desc || null,
    place: e.place || null,
    city: e.city || null,
    lat: e.lat === '' ? null : Number(e.lat),
    lng: e.lng === '' ? null : Number(e.lng),
    entourage: e.who,
    responsible: e.resp || null,
    participants: e.part || null,
    simultaneous: e.simul || null,
    location_pending: !!e.pending,
    status: e.status === 'cancelada' ? 'cancelada' : 'confirmada',
    cancel_note: e.status === 'cancelada' ? (e.cancelNote || '') : ''
  };
}

/* ---------------- carregar e sincronizar ---------------- */
function useCache() {
  const c = local.get(CACHE_KEY);
  if (c && Array.isArray(c.events) && c.events.length) {
    EVENTS = c.events;
    lastSync = c.at || null;
    return true;
  }
  return false;
}

async function fetchAll(quiet) {
  if (!sb) { renderDiag(); return; }
  try {
    const { data, error } = await sb.from('events').select('*').order('event_date').order('event_time', { nullsFirst: false });
    if (error) throw error;
    EVENTS = (data || []).map(fromRow);
    lastSync = new Date().toISOString();
    local.set(CACHE_KEY, { at: lastSync, events: EVENTS });
    if (!dates().includes(selectedDate)) {
      const t = todayISO();
      selectedDate = dates().includes(t) ? t : (dates()[0] || t);
    }
    banner('');
    render(); renderAdminList(); renderDiag();
  } catch (e) {
    const usouCache = EVENTS.length > 0;
    banner(usouCache
      ? 'Sem conexão. Mostrando a agenda salva no aparelho' + (lastSync ? ` às ${new Date(lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '') + '.'
      : 'Não foi possível carregar a agenda. Verifique a conexão.', 'warn');
    if (!quiet) renderDiag();
  }
}

/* alterações de outras pessoas chegam por aqui, sem recarregar */
function listenRealtime() {
  if (!sb) return;
  sb.channel('agenda-eventos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, payload => {
      const antes = EVENTS.length;
      fetchAll(true).then(() => {
        const nova = payload.new || {};
        if (payload.eventType === 'DELETE' || payload.event === 'DELETE') {
          notificar('Agenda removida', 'A coordenação retirou um compromisso.');
        } else if (nova.status === 'cancelada') {
          notificar('Agenda cancelada', `${nova.title || 'Um compromisso'} não vai acontecer.`);
        } else if (EVENTS.length > antes) {
          notificar('Nova agenda', nova.title || 'A coordenação lançou um compromisso.');
        } else {
          toast('Agenda atualizada pela coordenação');
        }
      });
    })
    .subscribe();
}

/* aviso no aparelho quando o app está aberto ou em segundo plano */
function notificar(titulo, corpo) {
  toast(titulo + ' — ' + corpo);
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(titulo, { body: corpo, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    }
  } catch (e) { /* navegador sem suporte */ }
}

/* ---------------- fila de escrita para quando cair a conexão ---------------- */
function outbox() { return local.get(OUTBOX_KEY) || []; }
function enfileirar(op, row) {
  const q = outbox(); q.push({ op, row, at: Date.now() });
  local.set(OUTBOX_KEY, q);
  renderDiag(); renderSyncLine();
}
async function flushOutbox() {
  if (!sb || !session) return;
  let q = outbox();
  if (!q.length) return;
  const restantes = [];
  for (const item of q) {
    try {
      if (item.op === 'delete') {
        const { error } = await sb.from('events').delete().eq('id', item.row.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('events').upsert(item.row);
        if (error) throw error;
      }
    } catch (e) { restantes.push(item); }
  }
  local.set(OUTBOX_KEY, restantes);
  if (!restantes.length) toast('Alterações pendentes publicadas');
  renderDiag(); renderSyncLine();
  fetchAll(true);
}

/* ---------------- gravar ---------------- */
async function salvarRow(row, msgOk) {
  /* pinta na hora */
  const e = fromRow(row);
  const i = EVENTS.findIndex(x => x.id === e.id);
  if (i >= 0) EVENTS[i] = e; else EVENTS.push(e);
  local.set(CACHE_KEY, { at: lastSync, events: EVENTS });
  render(); renderAdminList();

  if (!sb || !session) { enfileirar('upsert', row); toast('Sem conexão com o banco. Alteração na fila para publicar.'); return; }
  try {
    const { error } = await sb.from('events').upsert(row);
    if (error) throw error;
    toast(msgOk);
    fetchAll(true);
  } catch (err) {
    enfileirar('upsert', row);
    toast('Sem conexão. A alteração vai subir sozinha quando a internet voltar.');
  }
}

async function apagarRow(id) {
  EVENTS = EVENTS.filter(x => x.id !== id);
  local.set(CACHE_KEY, { at: lastSync, events: EVENTS });
  render(); renderAdminList();
  if (!sb || !session) { enfileirar('delete', { id }); return; }
  try {
    const { error } = await sb.from('events').delete().eq('id', id);
    if (error) throw error;
    toast('Agenda excluída');
  } catch (e) {
    enfileirar('delete', { id });
    toast('Sem conexão. A exclusão vai subir quando a internet voltar.');
  }
}

/* ---------------- render ---------------- */
function dates() { return [...new Set(EVENTS.map(e => e.date))].sort(); }

function renderRail() {
  const rail = $('#rail');
  const ds = dates();
  const t = todayISO();
  rail.innerHTML = ds.map(d => {
    const dt = parseISO(d);
    const n = EVENTS.filter(e => e.date === d).length;
    return `<button class="day ${n ? 'has' : ''} ${d === t ? 'today' : ''}" role="tab" type="button"
      aria-selected="${d === selectedDate}" data-date="${d}" title="${n} agenda${n === 1 ? '' : 's'}">
      <span class="dw">${WD[dt.getDay()]}</span>
      <span class="dn">${String(dt.getDate()).padStart(2, '0')}</span>
      <span class="dot"></span>
    </button>`;
  }).join('');
  rail.querySelectorAll('.day').forEach(b => {
    b.onclick = () => { selectedDate = b.dataset.date; render(); scrollRailTo(); };
  });
}
function scrollRailTo() {
  const el = $(`#rail .day[data-date="${selectedDate}"]`);
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function renderDayHead() {
  if (!selectedDate) return;
  const list = EVENTS.filter(e => e.date === selectedDate);
  const cities = [...new Set(list.map(e => e.city).filter(Boolean))];
  $('#dayCity').textContent = (cities[0] || 'Sem cidade definida').toUpperCase();

  const dt = parseISO(selectedDate);
  const off = list.filter(e => e.status === 'cancelada').length;
  const on = list.length - off;
  const parts = [`${WD_LONG[dt.getDay()]}, ${dt.getDate()} de ${MONTH[dt.getMonth()]}`, `${on} agenda${on === 1 ? '' : 's'}`];
  if (off) parts.push(`${off} cancelada${off === 1 ? '' : 's'}`);
  const others = cities.slice(1);
  if (others.length) parts.push(`frentes também em ${others.join(' e ')}`);
  $('#dayMeta').textContent = parts.join(' · ');
}

function renderFilters() {
  const box = $('#filters');
  box.innerHTML = Object.entries(GROUPS).map(([k, g]) => `
    <button class="chip" type="button" data-g="${k}" aria-pressed="${activeGroups.has(k)}" style="color:${activeGroups.has(k) ? 'var(--ink)' : g.color}">
      <span class="sw" style="background:${g.color}"></span>${g.label}
    </button>`).join('') +
    `<button class="chip" type="button" data-g="__all" aria-pressed="${activeGroups.size === 0}">Tudo</button>`;
  box.querySelectorAll('.chip').forEach(c => {
    c.onclick = () => {
      const g = c.dataset.g;
      if (g === '__all') activeGroups.clear();
      else activeGroups.has(g) ? activeGroups.delete(g) : activeGroups.add(g);
      render();
    };
  });
}

function renderNextUp() {
  const box = $('#nextup');
  if (selectedDate !== todayISO()) { box.innerHTML = ''; return; }
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const next = EVENTS.filter(e => e.date === selectedDate && e.status !== 'cancelada').sort(byTime).find(e => sortKey(e) >= hhmm);
  if (!next) { box.innerHTML = ''; return; }

  const g = GROUPS[TYPES[next.type].group];
  let when;
  if (next.time) {
    const [h, m] = next.time.split(':').map(Number);
    const diff = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m) - now) / 60000);
    when = diff <= 0 ? 'começando agora' : diff < 60 ? `em ${diff} min` : `em ${Math.floor(diff / 60)}h${String(diff % 60).padStart(2, '0')}`;
  } else when = PERIOD_LABEL[next.period];

  box.innerHTML = `<div class="nextup">
    <div class="node" style="background:${g.color}22;border-color:${g.color}66;color:${g.color}">${ICONS[next.type]}</div>
    <div>
      <div class="label">A seguir · ${esc(when)}</div>
      <div class="t">${esc(next.title)}</div>
      <div class="s">${esc([next.time || PERIOD_LABEL[next.period], next.place, next.city].filter(Boolean).join(' · '))}</div>
    </div>
  </div>`;
}

function visible() {
  const q = query.trim().toLowerCase();
  return EVENTS
    .filter(e => e.date === selectedDate)
    .filter(e => activeGroups.size === 0 || activeGroups.has(TYPES[e.type].group))
    .filter(e => {
      if (!q) return true;
      return [e.title, e.desc, e.place, e.city, e.resp, e.part, TYPES[e.type].label, WHO[e.who] && WHO[e.who].label]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    })
    .sort(byTime);
}

function eventCard(e) {
  const ty = TYPES[e.type], g = GROUPS[ty.group];
  const off = e.status === 'cancelada';
  const hasLoc = !off && !!(e.place || (e.lat && e.lng) || e.city);
  return `<article class="slot ${off ? 'cancelled' : ''}">
    <div class="gutter">
      <div class="time">${e.time ? esc(e.time) : `<small>${esc(PERIOD_LABEL[e.period] || '—')}</small>`}</div>
      <div class="node" style="background:${g.color}1f;border-color:${g.color}59;color:${g.color}">${ICONS[e.type]}</div>
    </div>
    <div class="card ${e.simul ? 'simul' : ''} ${off ? 'cancelled' : ''}">
      <div class="kind" style="color:${g.color}">${esc(ty.label)}</div>
      <h3>${esc(e.title)}</h3>
      ${off ? `<div class="cancelnote"><b>Agenda cancelada.</b> ${e.cancelNote ? esc(e.cancelNote) : 'Não se deslocar para o local.'}</div>` : ''}
      ${e.desc ? `<p>${esc(e.desc)}</p>` : ''}
      ${e.place ? `<div class="place">${ICON_PIN}<span>${esc(e.place)}${e.city ? ` — ${esc(e.city)}` : ''}</span></div>`
        : e.city ? `<div class="place">${ICON_PIN}<span>${esc(e.city)}</span></div>` : ''}
      ${e.pending && !off ? `<div class="pending">${ICON_WARN} Local exato a confirmar com a coordenação</div>` : ''}
      <div class="tags">
        ${off ? `<span class="tag cancel">${ICON_CANCEL} Cancelada</span>` : ''}
        ${e.who ? `<span class="tag who">${esc(WHO[e.who].label)}</span>` : ''}
        ${e.simul ? `<span class="tag alert">${esc(e.simul)}</span>` : ''}
        ${e.resp ? `<span class="tag">Responsável: ${esc(e.resp)}</span>` : ''}
      </div>
      ${e.part ? `<details class="who"><summary>Quem participa</summary><div class="more">${esc(e.part)}</div></details>` : ''}
      ${hasLoc ? `<div class="go">
        <a class="maps" href="${mapsUrl(e)}" target="_blank" rel="noopener">${ICON_PIN} Google Maps</a>
        <a class="waze" href="${wazeUrl(e)}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" width="15" height="15" ${S}><path d="M4.5 15.5A7.5 7.5 0 1 1 19 12.8c0 3.5-3.4 4.7-6.4 4.7H6"/><path d="M8.6 17.5v1.2"/><path d="M13.4 17.5v1.2"/><circle cx="9.6" cy="9.6" r=".6"/><circle cx="14" cy="9.6" r=".6"/></svg>
          Waze</a>
      </div>` : ''}
    </div>
  </article>`;
}

function render() {
  renderRail(); renderDayHead(); renderFilters(); renderNextUp();
  const list = visible();
  $('#tl').innerHTML = list.length ? list.map(eventCard).join('')
    : `<div class="empty"><b>${EVENTS.length ? 'Nada aqui neste filtro' : 'Agenda ainda não carregada'}</b>
        ${EVENTS.length
          ? (query || activeGroups.size ? 'Limpe a busca ou toque em “Tudo”.' : 'A coordenação ainda não lançou agenda para este dia.')
          : 'Confira a conexão ou os dados em config.js.'}</div>`;
}

/* ---------------- enviar agenda do dia ---------------- */
function dayText() {
  const dt = parseISO(selectedDate);
  const head = `*AGENDA ${WD_LONG[dt.getDay()].toUpperCase()} ${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}*`;
  const lines = visible().map(e => {
    const when = e.time || PERIOD_LABEL[e.period] || '';
    const loc = [e.place, e.city].filter(Boolean).join(' — ');
    if (e.status === 'cancelada') return `~${when} • ${e.title}~\n   *CANCELADA*${e.cancelNote ? ` — ${e.cancelNote}` : ''}`;
    return `${when} • ${e.title}${loc ? `\n   ${loc}` : ''}${e.simul ? `\n   (${e.simul})` : ''}`;
  });
  return [head, '', ...lines, '', 'Mailza 11 — Governadora | Vice Jéssica Sales'].join('\n');
}
async function enviarDia() {
  const txt = dayText();
  if (navigator.share) {
    try { await navigator.share({ text: txt }); return; } catch (e) { /* usuário cancelou */ }
  }
  try { await navigator.clipboard.writeText(txt); toast('Agenda do dia copiada'); return; } catch (e) { /* segue */ }
  const ta = document.createElement('textarea');
  ta.value = txt; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('Agenda do dia copiada'); } catch (_) { toast('Não deu para copiar neste navegador'); }
  ta.remove();
}

/* ---------------- painel ---------------- */
function fillTypeSelect() {
  $('#f_type').innerHTML = Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
}

function renderDiag() {
  const d = $('#diagLine'); if (!d) return;
  const fila = outbox().length;
  d.textContent = [
    `banco: ${sb ? 'configurado' : 'não configurado (config.js)'}`,
    `conta: ${session ? session.user.email : 'sem login'}`,
    `agendas: ${EVENTS.length}`,
    lastSync ? `última leitura ${new Date(lastSync).toLocaleTimeString('pt-BR')}` : 'nunca sincronizou',
    fila ? `${fila} alteração(ões) na fila` : 'fila vazia'
  ].join(' · ');
}
function renderSyncLine() {
  const el = $('#syncLine'); if (!el) return;
  const fila = outbox().length;
  if (!sb) { el.className = 'sub syncbad'; el.textContent = 'Preencha config.js com os dados do Supabase para publicar.'; return; }
  if (fila) { el.className = 'sub syncbad'; el.textContent = `${fila} alteração(ões) esperando internet. Sobem sozinhas quando a conexão voltar.`; return; }
  el.className = 'sub'; el.textContent = 'As mudanças chegam no celular do time na hora que você salva.';
}

function renderAdminList() {
  const box = $('#adminList'); if (!box) return;
  const ds = dates();
  if (!ds.length) { box.innerHTML = `<div class="empty"><b>Agenda vazia</b>Toque em “Nova agenda” para lançar o primeiro compromisso.</div>`; return; }
  box.innerHTML = ds.map(d => {
    const dt = parseISO(d);
    const rows = EVENTS.filter(e => e.date === d).sort(byTime).map(e => {
      const off = e.status === 'cancelada';
      return `<div class="arow" ${off ? 'style="opacity:.6"' : ''}>
        <div class="at" ${off ? 'style="text-decoration:line-through"' : ''}>${esc(e.time || PERIOD_LABEL[e.period] || '—')}</div>
        <div class="an">${off ? `<s>${esc(e.title)}</s>` : esc(e.title)}<span>${off ? 'Cancelada · ' : ''}${esc([TYPES[e.type].label, e.place, e.city].filter(Boolean).join(' · '))}</span></div>
        <button class="icon-btn" type="button" data-toggle="${e.id}" title="${off ? 'Reativar agenda' : 'Cancelar agenda'}">
          ${off
            ? `<svg viewBox="0 0 24 24" width="15" height="15" ${S}><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/></svg>`
            : `<svg viewBox="0 0 24 24" width="15" height="15" ${S}><circle cx="12" cy="12" r="8.4"/><path d="m8.6 8.6 6.8 6.8"/></svg>`}
        </button>
        <button class="icon-btn" type="button" data-edit="${e.id}" title="Editar">
          <svg viewBox="0 0 24 24" width="15" height="15" ${S}><path d="M4 20h4l10-10-4-4L4 16z"/><path d="m14 6 4 4"/></svg>
        </button>
      </div>`;
    }).join('');
    return `<div class="adminday">${WD_LONG[dt.getDay()]} · ${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}</div>${rows}`;
  }).join('');
  box.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openEdit(b.dataset.edit));
  box.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => toggleCancel(b.dataset.toggle));
  renderSyncLine(); renderDiag();
}

function showEditErr(msg) {
  const b = $('#editErr');
  if (!msg) { b.hidden = true; b.textContent = ''; return; }
  b.hidden = false; b.textContent = msg;
}

function openDlg(sel) {
  const d = $(sel);
  if (typeof d.showModal === 'function') { try { d.showModal(); return; } catch (e) { } }
  d.setAttribute('open', '');
}
function closeDlg(sel) {
  const d = $(sel);
  if (typeof d.close === 'function') { try { d.close(); return; } catch (e) { } }
  d.removeAttribute('open');
}

function openEdit(id) {
  editingId = id || null;
  const e = id ? EVENTS.find(x => x.id === id) : null;
  $('#editTitle').textContent = e ? 'Editar agenda' : 'Nova agenda';
  $('#f_date').value = (e && e.date) || selectedDate || todayISO();
  $('#f_city').value = (e && e.city) || '';
  $('#f_time').value = (e && e.time) || '';
  $('#f_period').value = (e && e.period) || '';
  $('#f_type').value = (e && e.type) || 'reuniao';
  $('#f_title').value = (e && e.title) || '';
  $('#f_desc').value = (e && e.desc) || '';
  $('#f_place').value = (e && e.place) || '';
  $('#f_lat').value = (e && e.lat) || '';
  $('#f_lng').value = (e && e.lng) || '';
  $('#f_who').value = (e && e.who) || 'majoritario';
  $('#f_resp').value = (e && e.resp) || '';
  $('#f_part').value = (e && e.part) || '';
  $('#f_simul').value = (e && e.simul) || '';
  $('#f_pending').value = (e && e.pending) ? '1' : '';
  $('#f_status').value = (e && e.status === 'cancelada') ? 'cancelada' : 'confirmada';
  $('#f_cancelnote').value = (e && e.cancelNote) || '';
  syncCancelField();
  $('#f_period').disabled = !!$('#f_time').value;
  $('#btnDelete').style.display = e ? '' : 'none';
  pendingDelete = null; $('#btnDelete').textContent = 'Excluir'; showEditErr('');
  openDlg('#dlgEdit');
}
function syncCancelField() {
  const off = $('#f_status').value === 'cancelada';
  $('#f_cancelnote').disabled = !off;
  $('#f_cancelnote').parentElement.style.opacity = off ? '1' : '.45';
}

function readForm() {
  const time = $('#f_time').value;
  const status = $('#f_status').value === 'cancelada' ? 'cancelada' : '';
  return {
    id: editingId || (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'tmp-' + Date.now()),
    date: $('#f_date').value,
    time: time || '',
    period: time ? '' : ($('#f_period').value || 'dia'),
    type: $('#f_type').value,
    title: $('#f_title').value.trim(),
    desc: $('#f_desc').value.trim(),
    place: $('#f_place').value.trim(),
    city: $('#f_city').value.trim(),
    lat: $('#f_lat').value.trim(),
    lng: $('#f_lng').value.trim(),
    who: $('#f_who').value,
    resp: $('#f_resp').value.trim(),
    part: $('#f_part').value.trim(),
    simul: $('#f_simul').value,
    pending: $('#f_pending').value === '1',
    status,
    cancelNote: status === 'cancelada' ? $('#f_cancelnote').value.trim() : ''
  };
}

function saveEvent() {
  const e = readForm();
  if (!e.title) { showEditErr('Escreva o título da agenda.'); return; }
  if (!e.date) { showEditErr('Escolha a data.'); return; }
  showEditErr('');
  selectedDate = e.date;
  editingId = null;
  closeDlg('#dlgEdit');
  salvarRow(toRow(e), e.status === 'cancelada' ? 'Cancelamento publicado para o time' : 'Agenda publicada para o time');
}

function toggleCancel(id) {
  const e = EVENTS.find(x => x.id === id); if (!e) return;
  const novo = { ...e, status: e.status === 'cancelada' ? '' : 'cancelada' };
  if (novo.status !== 'cancelada') novo.cancelNote = '';
  salvarRow(toRow(novo), novo.status === 'cancelada' ? 'Cancelamento publicado para o time' : 'Agenda reativada');
}

function askDelete() {
  if (!editingId) return;
  if (pendingDelete !== editingId) {
    pendingDelete = editingId;
    $('#btnDelete').textContent = 'Confirmar exclusão';
    showEditErr('Excluir apaga a agenda para todo mundo. Se ela só não vai acontecer, use Situação: Cancelada — assim o time fica sabendo.');
    return;
  }
  const id = pendingDelete;
  pendingDelete = null; editingId = null;
  $('#btnDelete').textContent = 'Excluir'; showEditErr('');
  closeDlg('#dlgEdit');
  apagarRow(id);
}

async function verHistorico() {
  const box = $('#logList');
  box.innerHTML = '<div class="empty">Carregando…</div>';
  openDlg('#dlgLog');
  if (!sb) { box.innerHTML = '<div class="empty"><b>Sem banco configurado</b>Preencha config.js.</div>'; return; }
  try {
    const { data, error } = await sb.from('event_log').select('*').order('changed_at', { ascending: false }).limit(60);
    if (error) throw error;
    if (!data.length) { box.innerHTML = '<div class="empty"><b>Nenhuma alteração ainda</b>O histórico começa na primeira edição.</div>'; return; }
    const acao = { insert: 'criou', update: 'alterou', delete: 'excluiu' };
    box.innerHTML = data.map(r => `<div class="arow">
      <div class="an">${esc(r.title || 'Agenda')}<span>${esc(acao[r.action] || r.action)}${r.status === 'cancelada' ? ' (cancelada)' : ''} · ${esc(r.changed_by || '—')} · ${new Date(r.changed_at).toLocaleString('pt-BR')}</span></div>
    </div>`).join('');
  } catch (e) {
    box.innerHTML = '<div class="empty"><b>Não foi possível ler o histórico</b>Ele exige login da coordenação.</div>';
  }
}

/* ---------------- login ---------------- */
async function entrar() {
  const email = $('#email').value.trim();
  const senha = $('#senha').value;
  const err = $('#loginErr');
  if (!sb) { err.hidden = false; err.textContent = 'Preencha config.js com os dados do Supabase.'; return; }
  if (!email || !senha) { err.hidden = false; err.textContent = 'Informe e-mail e senha.'; return; }
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
    session = data.session;
    err.hidden = true;
    closeDlg('#dlgLogin');
    abrirPainel();
    flushOutbox();
    pedirNotificacao();
  } catch (e) {
    err.hidden = false;
    err.textContent = /Invalid login/i.test(String(e.message || e)) ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Verifique a conexão.';
  }
}
function abrirPainel() {
  renderSyncLine(); renderAdminList(); renderDiag();
  openDlg('#dlgAdmin');
}
async function pedirNotificacao() {
  try {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
  } catch (e) { }
}

/* ---------------- eventos de UI ---------------- */
$('#btnToday').onclick = () => {
  const t = todayISO();
  selectedDate = dates().includes(t) ? t : (dates()[0] || t);
  render(); scrollRailTo();
};
$('#fabNow').onclick = () => {
  const t = todayISO();
  if (dates().includes(t)) selectedDate = t;
  render(); scrollRailTo();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
$('#btnCopy').onclick = enviarDia;
$('#q').oninput = e => { query = e.target.value; render(); };

$('#btnAdmin').onclick = () => {
  if (session) abrirPainel();
  else { $('#email').value = ''; $('#senha').value = ''; $('#loginErr').hidden = true; openDlg('#dlgLogin'); }
};
$('#loginCancel').onclick = () => closeDlg('#dlgLogin');
$('#loginOk').onclick = entrar;
$('#senha').onkeydown = e => { if (e.key === 'Enter') entrar(); };

$('#btnNew').onclick = () => openEdit(null);
$('#btnCloseAdmin').onclick = () => closeDlg('#dlgAdmin');
$('#btnSave').onclick = saveEvent;
$('#btnCancelEdit').onclick = () => {
  pendingDelete = null; $('#btnDelete').textContent = 'Excluir'; showEditErr('');
  closeDlg('#dlgEdit');
};
$('#btnDelete').onclick = askDelete;
$('#f_status').onchange = syncCancelField;
$('#f_time').onchange = () => { $('#f_period').disabled = !!$('#f_time').value; };

$('#btnLog').onclick = verHistorico;
$('#btnCloseLog').onclick = () => closeDlg('#dlgLog');
$('#btnLogout').onclick = async () => {
  try { if (sb) await sb.auth.signOut(); } catch (e) { }
  session = null;
  closeDlg('#dlgAdmin');
  toast('Você saiu da conta da coordenação');
};
$('#btnExport').onclick = () => {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), events: EVENTS }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `agenda-mailza-${todayISO()}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  toast('Backup baixado');
};

window.addEventListener('online', () => { banner(''); flushOutbox(); fetchAll(true); });
window.addEventListener('offline', () => banner('Sem conexão. Você está vendo a agenda salva no aparelho.', 'warn'));
document.addEventListener('visibilitychange', () => { if (!document.hidden) fetchAll(true); });
setInterval(() => fetchAll(true), 120000);
setInterval(renderNextUp, 60000);

/* ---------------- início ---------------- */
(async function init() {
  fillTypeSelect();
  syncCancelField();

  const t = todayISO();
  if (useCache()) {
    selectedDate = dates().includes(t) ? t : (dates()[0] || t);
    render(); scrollRailTo();
  }

  if (sb) {
    try {
      const { data } = await sb.auth.getSession();
      session = data ? data.session : null;
    } catch (e) { session = null; }
    sb.auth.onAuthStateChange((_e, s) => { session = s; renderDiag(); });
    listenRealtime();
    flushOutbox();
  }

  await fetchAll();
  if (!selectedDate) { selectedDate = dates().includes(t) ? t : (dates()[0] || t); render(); }

  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { }
  }
})();
