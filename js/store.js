// Стан застосунку в localStorage. Щоденник, позначки й нотатки до віршів — в IndexedDB (db.js).
const KEY = 'slovo:v1';

const DEFAULTS = {
  settings: {
    theme: 'auto',       // auto | light | dark
    fontSize: 19,        // px
    lineHeight: 1.7,
    layout: 'flow',      // flow — суцільний текст, lines — кожен вірш з нового рядка
    accents: true,       // наголоси в тексті Огієнка
    verseNumbers: true,
    parallel: false,     // паралельний французький текст (Louis Segond 1910)
    ttsRate: 1,          // швидкість озвучення
  },
  last: null,            // { id, n, y, at } — де зупинилися в Біблії
  testament: 'nt',       // остання вкладка Завіту
  read: {},              // { 'MRK.1': '2026-10-21' } — прочитані розділи
  plans: {
    active: 'mark30',
    churchCalendar: 'new', // new — новоюліанський, old — юліанський
    progress: {},        // { mark30: { started, done: { 1: '2026-10-21' }, step: { key, step } } }
  },
  activity: {},          // { '2026-10-21': { plan: 1, lectio: 0, chapters: 2 } } — дні з читанням
  achievements: {},      // { first: '2026-10-21' }
  welcomeSeen: null,     // дата останньої активності, після якої вже показали «Раді, що ти повернувся»
  reminder: { enabled: false, time: '08:00' },
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') {
      return {
        ...structuredClone(DEFAULTS), ...raw,
        settings: { ...DEFAULTS.settings, ...raw.settings },
        plans: { ...DEFAULTS.plans, ...raw.plans },
        reminder: { ...DEFAULTS.reminder, ...raw.reminder },
      };
    }
  } catch { /* приватний режим або пошкоджені дані */ }
  return structuredClone(DEFAULTS);
}

export const state = load();

let saveTimer;
export function save(now = false) {
  clearTimeout(saveTimer);
  const write = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* сховище недоступне */ }
  };
  if (now) write(); else saveTimer = setTimeout(write, 150);
}
window.addEventListener('pagehide', () => save(true));

const listeners = new Set();
export function onSettings(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function updateSettings(patch) {
  Object.assign(state.settings, patch);
  save();
  listeners.forEach((fn) => fn(state.settings));
}

export function todayKey(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Подія для прогресу й досягнень (progress.js слухає її)
export function logActivity(kind, amount = 1) {
  const k = todayKey();
  const day = (state.activity[k] ??= {});
  day[kind] = (day[kind] || 0) + amount;
  save();
  window.dispatchEvent(new CustomEvent('slovo:activity', { detail: { kind } }));
}

export function markRead(id, n) {
  const k = `${id}.${n}`;
  if (state.read[k]) return false;
  state.read[k] = todayKey();
  save();
  logActivity('chapters');
  return true;
}

export function isRead(id, n) { return !!state.read[`${id}.${n}`]; }
