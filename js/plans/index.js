import mark30 from './mark30.js';
import life40 from './life40.js';
import { FOCUS, QUESTIONS, PRAYERS, pick } from './generic.js';
import { BOOK_INFO } from '../books-info.js';
import { state, save, todayKey, parseKey, markRead, logActivity } from '../store.js';
import { loadBooks, book, parseRange, rangeLabel } from '../bible.js';
import { readingsFor } from '../lectionary.js';

// ── Опис планів
export const PLAN_LIST = [
  { id: 'mark30', kind: 'seq', length: 30, title: mark30.title, subtitle: '30 днів · для початківців', description: mark30.description, recommended: true },
  { id: 'life40', kind: 'seq', length: 40, title: life40.title, subtitle: life40.subtitle, description: life40.description },
  {
    id: 'pp', kind: 'seq', length: 31, file: 'data/plans/psalms-proverbs.json',
    title: 'Псалми і Притчі за місяць', subtitle: '31 день',
    description: 'Усі 150 псалмів і всі 31 розділ Приповістей за місяць. Псалми вчать молитися, Приповісті — мудро жити щодня. Близько 15–20 хвилин.',
  },
  {
    id: 'year', kind: 'seq', length: 365, file: 'data/plans/year.json',
    title: 'Біблія за рік', subtitle: '365 днів',
    description: 'Щодня уривок зі Старого Завіту, з Нового Завіту і псалом. За рік — уся Біблія. Близько 20 хвилин на день.',
  },
  {
    id: 'church', kind: 'daily',
    title: 'Церковні читання дня', subtitle: 'Апостол і Євангеліє',
    description: 'Ті самі уривки, що сьогодні читають на Літургії у православних і греко-католицьких храмах. Можна обрати новоюліанський або юліанський календар.',
  },
];

export const planMeta = (id) => PLAN_LIST.find((p) => p.id === id) || PLAN_LIST[0];
export const activePlan = () => planMeta(state.plans.active);

export function setActivePlan(id) {
  state.plans.active = id;
  save(true);
}

const files = new Map();
function loadFile(meta) {
  if (!files.has(meta.id)) {
    const p = fetch(meta.file).then((r) => r.json());
    p.catch(() => files.delete(meta.id));
    files.set(meta.id, p);
  }
  return files.get(meta.id);
}

// ── Прогрес
export function progress(id) {
  state.plans.progress[id] ??= { started: null, done: {}, step: null };
  return state.plans.progress[id];
}
export const isDone = (meta, key) => !!progress(meta.id).done[key];
export const doneCount = (meta) => Object.keys(progress(meta.id).done).length;

// Наступний день — перший незавершений, а не за календарем: пропуск не створює «боргів»
export function nextDay(meta) {
  if (meta.kind === 'daily') return todayKey();
  for (let n = 1; n <= meta.length; n++) if (!isDone(meta, n)) return n;
  return null;
}

// День, завершений сьогодні (якщо є)
export function doneTodayKey(meta) {
  const today = todayKey();
  if (meta.kind === 'daily') return isDone(meta, today) ? today : null;
  const days = Object.entries(progress(meta.id).done).filter(([, d]) => d === today).map(([n]) => +n);
  return days.length ? Math.max(...days) : null;
}

export function setStep(meta, key, step) {
  progress(meta.id).step = { key: String(key), step };
  save();
}
export function savedStep(meta, key) {
  const s = progress(meta.id).step;
  return s && s.key === String(key) ? s.step : 0;
}

export async function completeDay(meta, key, day) {
  const p = progress(meta.id);
  p.started ??= todayKey();
  p.done[key] = todayKey();
  if (p.step?.key === String(key)) p.step = null;
  // Позначаємо розділи Біблії, дочитані до кінця
  await loadBooks();
  for (const r of day.readings) {
    for (const [id, range] of r.segs) {
      const { c1, c2, v2 } = parseRange(range);
      const b = book(id);
      for (let c = c1; c <= c2; c++) if (c < c2 || v2 >= (b?.verses[c - 1] ?? Infinity)) markRead(id, c);
    }
  }
  save(true);
  logActivity('plan');
}

// ── Нормалізований день плану
// { key, label, title, readings: [{ label, segs: [[id, range]], note? }], intro: [..], focus, questions, prayer, verse }
const LABELS = { ot: 'Старий Завіт', nt: 'Новий Завіт', ps: 'Псалом', pr: 'Приповісті' };

export async function getDay(meta, key) {
  await loadBooks();
  if (meta.id === 'mark30') {
    const d = mark30.days[key - 1];
    const [c, v] = d.verse.split(':').map(Number);
    return {
      key, label: `День ${key}`, title: d.title, intro: [d.intro], focus: d.focus, questions: d.questions, prayer: d.prayer,
      readings: [{ label: 'Євангеліє', segs: [['MRK', d.gospel]] }, { label: 'Псалом', segs: [['PSA', d.psalm]] }],
      verse: { id: 'MRK', c, v },
    };
  }
  if (meta.id === 'life40') {
    const d = life40.days[key - 1];
    const [c, v] = d.verse[1].split(':').map(Number);
    return {
      key, label: `День ${key}`, title: d.title, intro: [d.intro], focus: d.focus, questions: d.questions, prayer: d.prayer,
      readings: d.readings.map(([id, range]) => ({ label: 'Євангеліє', segs: [[id, range]] })),
      verse: { id: d.verse[0], c, v },
    };
  }
  if (meta.kind === 'seq') {
    const d = (await loadFile(meta)).days[key - 1];
    const readings = d.r.map(([id, range, tag]) => ({ label: LABELS[tag], segs: [[id, range]] }));
    return {
      key, label: `День ${key}`, readings,
      title: d.r.filter(([, , t]) => t !== 'ps' || meta.id === 'pp').slice(0, 2).map(([id, range]) => shortTitle(id, range)).join(' · '),
      intro: introFor(d.r.map(([id, range]) => [id, range]), meta.id === 'pp' ? ppIntro(key) : null),
      focus: pick(FOCUS, key), questions: [pick(QUESTIONS, key), pick(QUESTIONS, key, 7)], prayer: pick(PRAYERS, key),
      verse: d.v ? { id: d.v[0], c: d.v[1], v: d.v[2] } : null,
    };
  }
  return churchDay(key);
}

function shortTitle(id, range) {
  const { c1, c2 } = parseRange(range);
  const b = book(id);
  const name = id === 'PSA' ? (c1 === c2 ? 'Псалом' : 'Псалми') : b.short;
  return c1 === c2 ? `${name} ${c1}` : `${name} ${c1}–${c2}`;
}

function ppIntro(n) {
  return n === 1 ? null : 'Псалми — молитви на всі стани душі: радість, страх, подяку, покаяння. Приповісті — мудрість для звичайного дня. Читай псалми повільно, як власну молитву.';
}

function introFor(segs, lead) {
  const out = lead ? [lead] : [];
  const seen = new Set();
  for (const [id, range] of segs) {
    if (seen.has(id)) continue;
    seen.add(id);
    const info = BOOK_INFO[id];
    if (!info) continue;
    const { c1, v1 } = parseRange(range);
    if (c1 === 1 && v1 === 1) out.push(`Сьогодні починаємо: ${book(id).name}. ${info.intro}`);
    else out.push(`Продовжуємо ${info.tag} (${rangeLabel(id, range)}).`);
  }
  return out;
}

// ── Церковні читання дня
const DESC = {
  Theotokos: 'Богородиці', Departed: 'за упокій', Forerunner: 'Предтечі', Apostles: 'апостолам', Fathers: 'святим отцям',
  Saints: 'святим', Annunciation: 'Благовіщенню', Meeting: 'Стрітенню', Bridegroom: 'Жениху',
};
function descLabel(desc) {
  if (!desc) return '';
  if (DESC[desc]) return DESC[desc];
  if (/^St[s]? /.test(desc)) return 'святому дня';
  if (/before|after|Afterfeast/i.test(desc)) return 'свята';
  return '';
}

const SRC = { E: 'Апостол', G: 'Євангеліє', H: '6-й час', V: 'Вечірня' };

export async function churchDay(key) {
  const date = parseKey(key);
  const cal = state.plans.churchCalendar;
  const r = await readingsFor(date, cal);
  const label = date.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
  const main = r.main.length ? r.main : r.lenten;
  const readings = main.map((x) => ({ label: SRC[x.src], segs: x.peri }));
  const extra = r.extra.map((x) => ({ label: SRC[x.src], note: descLabel(x.desc), segs: x.peri }));
  // Велике свято дає назву дню; у неділю менше свято лише згадуємо
  const title = r.feast && (r.feastLevel >= 6 || (r.feastLevel >= 4 && r.weekday !== 0)) ? r.feast : r.title;
  const intro = [
    title === r.feast ? `${r.title}.` : r.feast ? `Сьогодні також: ${r.feast}.` : null,
    main.length
      ? (r.main.length
        ? 'Сьогодні на Літургії читають уривок з Апостола (Діянь чи послань) і з Євангелія. Прочитати їх удома — це ніби бути разом з усією Церквою.'
        : 'У будні Великого посту Літургії немає, тож замість Апостола й Євангелія Церква читає Старий Завіт — пророка Ісаю, книги Буття і Приповістей.')
      : 'На цей день у лекціонарії немає окремих читань Апостола і Євангелія.',
  ].filter(Boolean);
  const ids = [...new Set(main.flatMap((x) => x.peri.map(([id]) => id)))];
  for (const id of ids) if (BOOK_INFO[id]) intro.push(`${book(id).name}. ${BOOK_INFO[id].intro}`);
  const n = Math.floor(date / 864e5);
  return {
    key, label: label.charAt(0).toUpperCase() + label.slice(1), title, intro,
    focus: pick(FOCUS, n), questions: [pick(QUESTIONS, n), pick(QUESTIONS, n, 7)], prayer: pick(PRAYERS, n),
    readings, extra, verse: null, calendar: cal,
  };
}

// Короткий опис посилань дня: «Мк 1:1–20 · Пс 1»
export function dayRefs(day) {
  return day.readings.map((r) => r.segs.map(([id, range]) => rangeLabel(id, range)).join('; ')).join(' · ');
}

// Для списку днів плану без завантаження тексту
export async function dayList(meta) {
  await loadBooks();
  if (meta.id === 'mark30') {
    return mark30.days.map((d) => ({ title: d.title, refs: `${rangeLabel('MRK', d.gospel)} · ${rangeLabel('PSA', d.psalm)}` }));
  }
  if (meta.id === 'life40') {
    return life40.days.map((d) => ({ title: d.title, refs: d.readings.map(([id, r]) => rangeLabel(id, r)).join(' · ') }));
  }
  if (meta.kind === 'seq') {
    return (await loadFile(meta)).days.map((d) => ({
      title: d.r.filter(([, , t]) => t !== 'ps' || meta.id === 'pp').slice(0, 2).map(([id, r]) => shortTitle(id, r)).join(' · '),
      refs: d.r.map(([id, r]) => rangeLabel(id, r)).join(' · '),
    }));
  }
  return [];
}
