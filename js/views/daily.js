import { h, icon } from '../ui.js';
import { state, onSettings } from '../store.js';
import { loadBooks, passage, rangeLabel, rangeTitle, refLabel, parseRange, stripAccents } from '../bible.js';
import { buildVerses, readerClasses, frenchFor } from '../text.js';
import { journal } from '../db.js';
import { progress, setStep, savedStep, completeDay, isDone, nextDay, dayRefs, getDay } from '../plans/index.js';
import { listenButton, stopSpeaking } from '../tts.js';
import { openShareCard } from '../sharecard.js';

const STEPS = ['Перед читанням', 'Читай', 'Подумай', 'Помолись'];

// Хвилини: читання вголос ≈ 900 знаків/хв, плюс роздум і молитва
const minutesFor = (chars) => Math.max(10, Math.round(chars / 900 + 6));

export const journalId = (meta, key) => `plan:${meta.id}:${key}`;

// Тексти всіх читань дня: [{ label, title, items: [{ id, c, v, t }] }]
async function loadReadings(day) {
  return Promise.all(day.readings.map(async (r) => {
    const parts = await Promise.all(r.segs.map(async ([id, range]) => (await passage(id, range)).map((x) => ({ ...x, id }))));
    const [id0, range0] = r.segs[0];
    const title = r.segs.length === 1 ? rangeTitle(id0, range0) : r.segs.map(([id, range]) => rangeLabel(id, range)).join('; ');
    return { label: r.label, title, id: id0, items: parts.flat(), segs: r.segs };
  }));
}

// Вірш дня, якщо план його не задає: завершене речення помірної довжини з Євангелія чи псалма
function autoVerse(texts) {
  const pool = (texts.find((t) => t.label === 'Євангеліє') || texts[texts.length - 1])?.items || [];
  let best = null, bestScore = -1e9;
  for (const it of pool) {
    const t = stripAccents(it.t);
    let score = -Math.abs(t.length - 110) / 10;
    if (!/[.!?“»]\s*$/.test(t)) score -= 8;
    if (!/^[А-ЯІЇЄҐ„]/.test(t)) score -= 3;
    if (/Ісус|Господ|Бог/.test(t)) score += 3;
    if (score > bestScore) { best = it; bestScore = score; }
  }
  return best ? { id: best.id, c: best.c, v: best.v } : null;
}

// Картки дня: 4 кроки, гортаються свайпом або кнопками.
export async function dayDeck(meta, day, { onComplete } = {}) {
  await loadBooks();
  const texts = await loadReadings(day);
  day.verse ??= autoVerse(texts);
  const chars = texts.reduce((s, r) => s + r.items.reduce((a, x) => a + x.t.length, 0), 0);
  let step = Math.min(savedStep(meta, day.key), 3);
  const cleanups = [];

  const tabs = STEPS.map((label, i) => h('button', { class: 'step', role: 'tab', onclick: () => go(i) },
    h('span', { class: 'bar' }), h('span', { class: 'lbl' }, label)));
  const stepper = h('div', { class: 'steps', role: 'tablist', 'aria-label': 'Кроки читання' }, tabs);
  const card = h('div', { class: 'card day-card', role: 'tabpanel' });
  const el = h('section', { class: 'deck' }, stepper, card);

  function stepIntro() {
    return [
      h('div', { class: 'eyebrow' }, `${day.label} · ≈ ${minutesFor(chars)} хв`),
      h('h2', { class: 'day-title' }, day.title),
      h('div', { class: 'refs' }, dayRefs(day) || 'Читань немає'),
      ...day.intro.map((p, i) => h('p', { class: i === 0 ? 'intro' : 'intro more' }, p)),
      h('div', { class: 'focus' }, icon('leaf'), h('div', {}, h('strong', {}, 'Зверни увагу. '), day.focus)),
      nav(null, texts.length ? 'Читати' : 'Далі'),
    ];
  }

  function stepRead() {
    const box = h('div', { class: 'read-box' });
    const blocks = texts.map((r, i) => {
      const body = h('div', { class: 'reader-text' });
      readerClasses(body);
      body.append(buildVerses(r.items, { poetic: r.id === 'PSA' || r.id === 'PRO' }));
      frenchFor(r.id, r.items).then((fr) => {
        if (fr && body.isConnected) body.replaceChildren(buildVerses(r.items, { poetic: r.id === 'PSA', fr }));
      });
      return [
        i > 0 ? h('div', { class: 'ornament', 'aria-hidden': 'true' }, '✦') : null,
        h('div', { class: 'eyebrow' }, r.label),
        h('h3', { class: 'passage-title' }, r.title),
        body,
      ];
    });
    box.append(...blocks.flat().filter(Boolean));
    const first = texts[0];
    const lectioHref = day.verse ? `#/lectio/${day.verse.id}/${day.verse.c}/${Math.max(1, day.verse.v - 2)}-${day.verse.v + 2}` : null;
    return [
      h('div', { class: 'read-tools' },
        listenButton(() => box),
        lectioHref ? h('a', { class: 'btn ghost small', href: lectioHref }, icon('moon'), 'Повільне читання') : null),
      texts.length ? box : h('p', { class: 'hint' }, 'Сьогодні в лекціонарії немає окремих читань.'),
      day.extra?.length ? h('details', { class: 'extra-readings' },
        h('summary', {}, `Також сьогодні читають (${day.extra.length})`),
        h('ul', {}, day.extra.map((x) => h('li', {}, h('span', { class: 'lbl' }, `${x.label}${x.note ? ` ${x.note}` : ''}: `),
          x.segs.map(([id, range], k) => [k ? '; ' : '', h('a', { href: `#/read/${id}/${parseRange(range).c1}` }, rangeLabel(id, range))]))))) : null,
      first ? h('a', { class: 'open-bible', href: `#/read/${first.id}/${first.items[0]?.c || 1}` }, 'Відкрити в Біблії', icon('next')) : null,
      nav('Назад', 'Далі'),
    ];
  }

  function stepThink() {
    const status = h('span', { class: 'save-status', 'aria-live': 'polite' });
    const area = h('textarea', { class: 'journal-input', rows: 5, placeholder: 'Запиши свою думку, якщо хочеш…', 'aria-label': 'Думка для щоденника' });
    const id = journalId(meta, day.key);
    journal.get(id).then((e) => { if (e && !area.value) area.value = e.text; }).catch(() => {});
    let timer = null;
    const persist = async () => {
      timer = null;
      const text = area.value.trim();
      try {
        if (!text) { await journal.delete(id); status.textContent = ''; return; }
        const prev = await journal.get(id);
        const now = Date.now();
        await journal.put({
          id, type: 'reflection', plan: meta.id, planTitle: meta.title, day: day.key, book: texts[0]?.id || null,
          title: day.title, ref: dayRefs(day), questions: day.questions, text, created: prev?.created ?? now, updated: now,
        });
        status.textContent = 'Збережено в щоденнику';
      } catch {
        status.textContent = 'Не вдалося зберегти';
      }
    };
    area.addEventListener('input', () => { status.textContent = ''; clearTimeout(timer); timer = setTimeout(persist, 600); });
    area.addEventListener('blur', () => { if (timer) { clearTimeout(timer); persist(); } });
    cleanups.push(() => { if (timer) { clearTimeout(timer); persist(); } });

    return [
      h('div', { class: 'eyebrow' }, 'Подумай'),
      h('h2', { class: 'day-title' }, 'Що Бог говорить мені сьогодні?'),
      h('ol', { class: 'questions' }, day.questions.map((q) => h('li', {}, q))),
      h('p', { class: 'hint' }, 'Не поспішай. Можна перечитати вірш, який зачепив, і просто побути з ним.'),
      area,
      h('div', { class: 'save-row' }, status),
      nav('Назад', 'Далі'),
    ];
  }

  function stepPray() {
    return [
      h('div', { class: 'eyebrow' }, 'Помолись'),
      h('blockquote', { class: 'prayer' }, day.prayer),
      h('p', { class: 'hint' }, 'Можна помолитися цими словами, своїми — або просто хвилину побути в тиші перед Богом.'),
      h('div', { class: 'deck-nav' },
        h('button', { class: 'btn ghost', onclick: () => go(step - 1, 'back') }, 'Назад'),
        isDone(meta, day.key)
          ? h('span', { class: 'done-badge' }, icon('check'), 'Прочитано')
          : h('button', { class: 'btn', onclick: complete }, icon('check'), 'Амінь')),
    ];
  }

  function nav(backLabel, nextLabel) {
    return h('div', { class: 'deck-nav' },
      backLabel ? h('button', { class: 'btn ghost', onclick: () => go(step - 1, 'back') }, backLabel) : h('span'),
      h('button', { class: 'btn', onclick: () => go(step + 1) }, nextLabel, icon('next')));
  }

  async function complete() {
    await completeDay(meta, day.key, day);
    onComplete?.(day.key);
  }

  const builders = [stepIntro, stepRead, stepThink, stepPray];
  function draw(dir) {
    stopSpeaking();
    cleanups.splice(0).forEach((fn) => fn());
    card.replaceChildren(...builders[step]().filter(Boolean));
    card.classList.remove('slide-l', 'slide-r');
    void card.offsetWidth;
    if (dir) card.classList.add(dir === 'back' ? 'slide-r' : 'slide-l');
    tabs.forEach((t, i) => {
      t.classList.toggle('active', i === step);
      t.classList.toggle('past', i < step);
      t.setAttribute('aria-selected', String(i === step));
    });
  }

  function go(i, dir) {
    if (i < 0 || i > 3 || i === step) return;
    dir ??= i < step ? 'back' : 'fwd';
    step = i;
    setStep(meta, day.key, step);
    draw(dir);
    const top = el.getBoundingClientRect().top + window.scrollY - 12;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
  }

  let touch = null;
  card.addEventListener('touchstart', (e) => {
    if (e.target.closest('textarea, details') || e.touches.length > 1) { touch = null; return; }
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, at: Date.now() };
  }, { passive: true });
  card.addEventListener('touchend', (e) => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y;
    const fast = Date.now() - touch.at < 700;
    touch = null;
    if (fast && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) go(step + (dx < 0 ? 1 : -1));
  });

  const offSettings = onSettings(() => { if (step === 1) draw(); });
  draw();

  return { el, day, destroy() { offSettings(); stopSpeaking(); cleanups.splice(0).forEach((fn) => fn()); } };
}

// Картка після завершення дня
export async function doneCard(meta, key, { onAhead } = {}) {
  const daily = meta.kind === 'daily';
  const count = Object.keys(progress(meta.id).done).length;
  const nextN = nextDay(meta);
  const finished = !daily && nextN == null;
  const nextDayData = !daily && nextN ? await getDay(meta, nextN).catch(() => null) : null;
  const pct = daily ? 100 : Math.round((count / meta.length) * 100);
  const finishedText = {
    mark30: ['Ти прочитав усе Євангеліє від Марка', 'Тридцять днів поруч з Ісусом — від Йордану до порожнього гробу. Нехай ці слова й далі живуть у тобі.'],
    life40: ['Сорок днів із життям Ісуса', 'Від Віфлеєму до Вознесіння. Обери наступний план — або повертайся до улюблених сторінок.'],
    pp: ['Усі псалми й Приповісті прочитано', 'Місяць молитви й мудрості. Псалми можна молитися й далі — щодня.'],
    year: ['Уся Біблія за рік', 'Від «Споконвіку» до «Амінь». Це велика дорога — дякуємо, що ти пройшов її.'],
  }[meta.id] || ['План завершено', ''];

  return h('div', { class: 'card done-card' },
    h('div', { class: 'done-icon' }, icon('check')),
    h('div', { class: 'eyebrow' }, finished ? 'План завершено' : daily ? 'Читання дня завершено' : `День ${key} завершено`),
    h('h2', {}, finished ? finishedText[0] : 'Гарно, що ти знайшов час для Слова'),
    h('p', {}, finished ? finishedText[1]
      : daily ? 'Сьогодні ти читав разом з усією Церквою. Завтра на тебе чекатимуть нові читання.'
        : 'Те, що ти сьогодні прочитав, можна носити в серці цілий день. Повертайся завтра — продовжимо разом.'),
    !daily ? h('div', { class: 'progress' }, h('i', { style: { width: `${pct}%` } })) : null,
    !daily ? h('p', { class: 'progress-label' }, `Прочитано ${count} з ${meta.length}`) : h('p', { class: 'progress-label' }, `Днів із церковними читаннями: ${count}`),
    nextDayData ? h('div', { class: 'tomorrow' }, h('small', {}, `Далі — день ${nextN}`), h('strong', {}, nextDayData.title)) : null,
    !finished && !daily && onAhead ? h('button', { class: 'btn ghost small', onclick: onAhead }, 'Хочу прочитати вже зараз') : null,
    finished ? h('a', { class: 'btn small', href: '#/plans', style: { marginTop: '12px' } }, 'Обрати новий план') : null);
}

// Вірш дня + «Поділитися» (картка-картинка)
export async function verseOfDayCard(day) {
  if (!day?.verse) return null;
  const { id, c, v } = day.verse;
  const [item] = await passage(id, `${c}:${v}-${c}:${v}`);
  if (!item) return null;
  let text = state.settings.accents ? item.t : stripAccents(item.t);
  text = text.charAt(0).toUpperCase() + text.slice(1);
  const ref = refLabel(id, c, [v]);
  return h('div', { class: 'card verse-card' },
    h('div', { class: 'eyebrow' }, 'Вірш дня'),
    h('blockquote', {}, text),
    h('div', { class: 'verse-foot' },
      h('cite', {}, ref),
      h('button', { class: 'btn ghost small', onclick: () => openShareCard({ text, ref }) }, icon('share'), 'Поділитися')));
}
