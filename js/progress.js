import { state, save, todayKey, parseKey } from './store.js';
import { toast } from './ui.js';
import { PLAN_LIST, progress } from './plans/index.js';
import { books } from './bible.js';

// ── М'яка серія
// Пропущений день не обнуляє серію: щотижня (пн–нд) є 2 «дні відпочинку».
// Серія переривається лише тоді, коли за тиждень пропущено 3 дні чи більше.
export const REST_DAYS = 2;

const DAY = 864e5;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const weekStart = (d) => addDays(d, -((d.getDay() + 6) % 7)); // понеділок
export const isActive = (key) => !!state.activity[key];

export function streakInfo(now = new Date()) {
  const today = todayKey(now);
  const keys = Object.keys(state.activity).sort();
  const first = keys[0] ? parseKey(keys[0]) : null;
  let streak = 0;
  const misses = new Map();
  if (first) {
    for (let d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d >= first; d = addDays(d, -1)) {
      const k = todayKey(d);
      if (isActive(k)) { streak++; continue; }
      if (k === today) continue; // день ще не скінчився
      const w = todayKey(weekStart(d));
      const m = (misses.get(w) || 0) + 1;
      misses.set(w, m);
      if (m > REST_DAYS) break;
    }
  }

  // Поточний тиждень для смужки на головному екрані
  const ws = weekStart(now);
  let restUsed = 0;
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i);
    const k = todayKey(d);
    let status = 'future';
    if (isActive(k)) status = 'read';
    else if (k === today) status = 'today';
    else if (d < now && first && d >= first) {
      if (restUsed < REST_DAYS) { status = 'rest'; restUsed++; } else status = 'missed';
    }
    else if (d < now) status = 'none';
    return { key: k, date: d, status };
  });

  const before = keys.filter((k) => k < today);
  const lastActive = before.length ? before[before.length - 1] : null;
  const gap = lastActive ? Math.round((parseKey(today) - parseKey(lastActive)) / DAY) : 0;
  const welcomeBack = !!lastActive && gap >= 2 && !isActive(today) && state.welcomeSeen !== lastActive;

  return { streak, week, restUsed: Math.min(restUsed, REST_DAYS), restLeft: Math.max(0, REST_DAYS - restUsed), lastActive, gap, welcomeBack, totalDays: keys.length };
}

export function dismissWelcome() {
  const { lastActive } = streakInfo();
  state.welcomeSeen = lastActive;
  save();
}

// Дані для місячного календаря
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = weekStart(first);
  const today = todayKey();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    if (i >= 35 && d.getMonth() !== month) break;
    const k = todayKey(d);
    cells.push({ key: k, day: d.getDate(), inMonth: d.getMonth() === month, active: isActive(k), today: k === today, future: k > today });
  }
  return cells;
}

// ── Досягнення
const planDone = (id) => {
  const meta = PLAN_LIST.find((p) => p.id === id);
  return meta?.length && Object.keys(progress(id).done).length >= meta.length;
};
const sumKind = (kind) => Object.values(state.activity).reduce((s, d) => s + (d[kind] || 0), 0);

export const ACHIEVEMENTS = [
  { id: 'first', icon: 'leaf', title: 'Перший крок', desc: 'Перший день читання', test: () => Object.keys(state.activity).length >= 1 },
  { id: 'week', icon: 'sun', title: 'Тиждень зі Словом', desc: '7 днів читання', test: () => Object.keys(state.activity).length >= 7 },
  { id: 'month', icon: 'sun', title: 'Місяць зі Словом', desc: '30 днів читання', test: () => Object.keys(state.activity).length >= 30 },
  { id: 'hundred', icon: 'sun', title: 'Сто днів зі Словом', desc: '100 днів читання', test: () => Object.keys(state.activity).length >= 100 },
  { id: 'streak14', icon: 'leaf', title: 'Два тижні поспіль', desc: 'Мʼяка серія — 14 днів', test: () => streakInfo().streak >= 14 },
  { id: 'plan:mark30', icon: 'bible', title: 'Євангеліє від Марка прочитано', desc: 'План «Почни з Євангелія»', test: () => planDone('mark30') },
  { id: 'plan:life40', icon: 'bible', title: 'Шлях Ісуса пройдено', desc: 'План «Життя Ісуса»', test: () => planDone('life40') },
  { id: 'plan:pp', icon: 'bible', title: 'Місяць псалмів і мудрості', desc: 'План «Псалми і Притчі»', test: () => planDone('pp') },
  { id: 'plan:year', icon: 'bible', title: 'Уся Біблія прочитана', desc: 'План «Біблія за рік»', test: () => planDone('year') },
  { id: 'church30', icon: 'plans', title: 'Разом із Церквою', desc: '30 днів церковних читань', test: () => Object.keys(progress('church').done).length >= 30 },
  { id: 'lectio1', icon: 'moon', title: 'Тиша серця', desc: 'Перше повільне читання', test: () => sumKind('lectio') >= 1 },
  { id: 'lectio10', icon: 'moon', title: 'Учень тиші', desc: '10 повільних читань', test: () => sumKind('lectio') >= 10 },
];

// Прогрес по книгах (вільне читання й плани): скільки розділів прочитано
export function bookProgress() {
  return books().map((b) => {
    const read = b.verses.filter((_, i) => state.read[`${b.id}.${i + 1}`]).length;
    return { book: b, read, total: b.verses.length, done: read === b.verses.length };
  });
}

export function checkAchievements({ silent = false } = {}) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (!state.achievements[a.id] && a.test()) {
      state.achievements[a.id] = todayKey();
      fresh.push(a);
    }
  }
  for (const { book: b, done } of bookProgress()) {
    const id = `book:${b.id}`;
    if (done && !state.achievements[id]) {
      state.achievements[id] = todayKey();
      fresh.push({ id, title: `Прочитано: ${b.short}` });
    }
  }
  if (fresh.length) {
    save();
    if (!silent) toast(`Нове досягнення: ${fresh.map((a) => a.title).join(', ')}`);
  }
  return fresh;
}

window.addEventListener('slovo:activity', () => setTimeout(() => checkAchievements(), 400));
