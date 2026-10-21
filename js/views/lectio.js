import { h, icon, toast } from '../ui.js';
import { state, logActivity, todayKey } from '../store.js';
import { loadBooks, book, passage, rangeLabel, stripAccents } from '../bible.js';
import { journal } from '../db.js';
import { activePlan, nextDay, doneTodayKey, getDay } from '../plans/index.js';
import { listenButton, stopSpeaking } from '../tts.js';

// Короткі уривки, добрі для повільного читання
const PASSAGES = [
  ['PSA', 23, 1, 6, 'Господь — то мій Пастир'],
  ['MAT', 11, 28, 30, 'Прийдіть до Мене'],
  ['ISA', 43, 1, 5, 'Не бійся, бо Я тебе викупив'],
  ['LUK', 10, 38, 42, 'Марта і Марія'],
  ['JHN', 15, 1, 9, 'Я правдива Виноградина'],
  ['PSA', 139, 1, 12, 'Ти знаєш мене'],
  ['MAT', 6, 25, 34, 'Не журіться'],
  ['LUK', 15, 20, 24, 'Батько біжить назустріч'],
  ['MRK', 4, 35, 41, 'Буря на морі'],
  ['JHN', 14, 1, 6, 'Нехай серце вам не тривожиться'],
  ['ROM', 8, 35, 39, 'Ніщо не відлучить'],
  ['1CO', 13, 4, 8, 'Любов довготерпить'],
  ['PHP', 4, 4, 9, 'Радійте в Господі'],
  ['1JN', 4, 7, 12, 'Бог є любов'],
  ['LAM', 3, 22, 26, 'Нове кожного ранку'],
  ['LUK', 24, 28, 32, 'Чи не палало нам серце'],
  ['JHN', 21, 15, 17, 'Чи кохаєш Мене?'],
  ['PSA', 131, 1, 3, 'Як дитина при матері'],
];

const SILENCE_SEC = 60;

export async function renderHome() {
  await loadBooks();
  let suggestion = null;
  try {
    const meta = activePlan();
    const key = doneTodayKey(meta) ?? nextDay(meta) ?? 1;
    const day = await getDay(meta, key);
    // Ключовий вірш дня з контекстом; якщо його немає — початок першого читання
    const seg = day.readings.find((r) => r.label === 'Євангеліє')?.segs[0] || day.readings[0]?.segs[0];
    const [sid, srange] = seg || [];
    const m = srange?.match(/^(\d+):(\d+)/);
    const v = day.verse || (m ? { id: sid, c: +m[1], v: +m[2] + 2 } : null);
    if (v) {
      const len = book(v.id).verses[v.c - 1];
      suggestion = { id: v.id, c: v.c, a: Math.max(1, v.v - 2), b: Math.min(len, v.v + 2), title: `З сьогоднішнього читання · ${day.title}` };
    }
  } catch { /* без пропозиції */ }

  const item = (id, c, a, b, title) => h('li', {}, h('a', { href: `#/lectio/${id}/${c}/${a}-${b}` },
    h('span', { class: 'txt' }, h('strong', {}, title), h('small', {}, rangeLabel(id, `${c}:${a}-${c}:${b}`))), icon('next')));

  const el = h('div', { class: 'view-enter' },
    h('header', { class: 'page-head' },
      h('div', { class: 'eyebrow' }, 'Lectio Divina'),
      h('h1', {}, 'Повільне читання'),
      h('p', {}, 'Давній спосіб молитовного читання: кілька віршів, прочитаних неквапно, слово, що зачепило, роздум, молитва і тиша. Близько 10 хвилин.')),
    h('ol', { class: 'lectio-steps' },
      ['Прочитай уривок повільно', 'Перечитай і познач слово, що зачепило', 'Подумай, що воно говорить тобі', 'Помолись своїми словами', 'Побудь хвилину в тиші'].map((s) => h('li', {}, s))),
    suggestion ? h('a', { class: 'card hero link', href: `#/lectio/${suggestion.id}/${suggestion.c}/${suggestion.a}-${suggestion.b}` },
      h('div', { class: 'eyebrow' }, 'Пропонуємо сьогодні'),
      h('h2', {}, rangeLabel(suggestion.id, `${suggestion.c}:${suggestion.a}-${suggestion.c}:${suggestion.b}`)),
      h('p', {}, suggestion.title),
      h('span', { class: 'arrow' }, icon('next'))) : null,
    h('h2', { class: 'section-title' }, 'Уривки для повільного читання'),
    h('ul', { class: 'day-list lectio-list' }, PASSAGES.map((p) => item(...p))));
  return { el, tab: 'today', title: 'Повільне читання' };
}

export async function renderSession({ id, c, a, b }) {
  await loadBooks();
  const bk = book(id);
  if (!bk || !bk.verses[c - 1]) { location.replace('#/lectio'); return null; }
  b = Math.min(b, bk.verses[c - 1]);
  a = Math.max(1, Math.min(a, b));
  const range = `${c}:${a}-${c}:${b}`;
  const ref = rangeLabel(id, range);
  const items = await passage(id, range);
  const fmt = state.settings.accents ? (t) => t : stripAccents;

  const words = new Set(); // індекси обраних слів 'v:i'
  let meditation = '', prayer = '';
  let step = 0;
  let timer = null;
  const cleanups = [];

  const STEPS = ['Прочитай', 'Перечитай', 'Подумай', 'Помолись', 'Тиша'];
  const tabs = STEPS.map((label, i) => h('button', { class: 'step', onclick: () => go(i) }, h('span', { class: 'bar' }), h('span', { class: 'lbl' }, label)));
  const card = h('div', { class: 'card day-card lectio' });

  const textBlock = (selectable) => {
    const box = h('div', { class: `reader-text lectio-text${selectable ? ' selectable' : ''}` });
    for (const it of items) {
      const p = h('p', { class: 'poem' }, h('span', { class: 'v', 'data-v': it.v }, h('span', { class: 'vn' }, it.v),
        ...(selectable ? fmt(it.t).split(/(\s+)/).map((w, i) => {
          if (!w.trim()) return w;
          const key = `${it.v}:${i}`;
          return h('span', { class: words.has(key) ? 'w on' : 'w', 'data-k': key }, w);
        }) : [fmt(it.t)])));
      box.append(p);
    }
    if (selectable) {
      box.addEventListener('click', (e) => {
        const w = e.target.closest('.w');
        if (!w) return;
        const k = w.dataset.k;
        if (words.has(k)) words.delete(k); else words.add(k);
        w.classList.toggle('on', words.has(k));
        chosen.textContent = chosenText() || '—';
      });
    }
    return box;
  };
  // Обрані слова в порядку тексту (не залежить від того, який крок зараз показано)
  const chosenText = () => items.flatMap((it) => fmt(it.t).split(/(\s+)/)
    .map((w, i) => (words.has(`${it.v}:${i}`) ? w.replace(/[,.;:!?—„“«»()]/g, '') : null)).filter(Boolean)).join(' ');
  let chosen = h('strong');

  const nav = (back, next, onNext) => h('div', { class: 'deck-nav' },
    back ? h('button', { class: 'btn ghost', onclick: () => go(step - 1) }, back) : h('span'),
    h('button', { class: 'btn', onclick: onNext || (() => go(step + 1)) }, next, icon('next')));

  const builders = [
    () => {
      const box = textBlock(false);
      return [
        h('div', { class: 'eyebrow' }, `Lectio · ${ref}`),
        h('h2', { class: 'day-title' }, 'Прочитай повільно'),
        h('p', { class: 'hint' }, 'Не поспішай. Можна читати вголос або пошепки, ніби пробуючи кожне слово.'),
        h('div', { class: 'read-tools' }, listenButton(() => box)),
        box,
        nav(null, 'Перечитати'),
      ];
    },
    () => {
      chosen = h('strong', {}, chosenText() || '—');
      return [
        h('div', { class: 'eyebrow' }, 'Перечитай'),
        h('h2', { class: 'day-title' }, 'Яке слово тебе зачепило?'),
        h('p', { class: 'hint' }, 'Прочитай ще раз і торкнися слова чи кількох слів, які ніби звучать саме для тебе.'),
        textBlock(true),
        h('p', { class: 'chosen' }, 'Твоє слово: ', chosen),
        nav('Назад', 'Далі'),
      ];
    },
    () => {
      const area = h('textarea', { class: 'journal-input', rows: 4, placeholder: 'Що це слово говорить про моє життя сьогодні?', oninput: (e) => { meditation = e.target.value; } });
      area.value = meditation;
      return [
        h('div', { class: 'eyebrow' }, 'Meditatio'),
        h('h2', { class: 'day-title' }, 'Подумай'),
        h('blockquote', { class: 'chosen-big' }, chosenText() || 'Повернися до вірша, який найбільше відгукнувся.'),
        h('ol', { class: 'questions' },
          h('li', {}, 'Чому, на твою думку, зачепило саме це слово?'),
          h('li', {}, 'З якою ситуацією чи людиною в твоєму житті воно перегукується?')),
        area,
        nav('Назад', 'Далі'),
      ];
    },
    () => {
      const area = h('textarea', { class: 'journal-input', rows: 4, placeholder: 'Боже, …', oninput: (e) => { prayer = e.target.value; } });
      area.value = prayer;
      return [
        h('div', { class: 'eyebrow' }, 'Oratio'),
        h('h2', { class: 'day-title' }, 'Помолись'),
        h('p', { class: 'intro' }, 'Скажи Богові своїми словами те, що піднялося в серці: подяку, прохання, жаль чи просто «я тут». Можна записати, а можна промовити подумки.'),
        area,
        nav('Назад', 'До тиші'),
      ];
    },
    () => {
      const total = SILENCE_SEC;
      let left = total, startedAt = null, elapsedBefore = 0;
      const R = 52, C = 2 * Math.PI * R;
      const ring = h('div', { class: 'ring', html: `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${R}" class="track"/><circle cx="60" cy="60" r="${R}" class="fill" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>` });
      const time = h('div', { class: 'ring-time' }, '1:00');
      const startBtn = h('button', { class: 'btn', onclick: toggleTimer }, icon('play'), 'Почати тишу');
      const finishBtn = h('button', { class: 'btn ghost', onclick: finish }, 'Завершити');
      const tick = () => {
        const elapsed = elapsedBefore + (startedAt ? (Date.now() - startedAt) / 1000 : 0);
        left = Math.max(0, total - elapsed);
        const s = Math.ceil(left);
        time.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        ring.querySelector('.fill').setAttribute('stroke-dashoffset', String(C * (1 - left / total)));
        if (left <= 0) { clearInterval(timer); timer = null; startedAt = null; chime(); time.textContent = 'Амінь'; startBtn.hidden = true; finishBtn.className = 'btn'; }
      };
      function toggleTimer() {
        if (timer) {
          elapsedBefore += (Date.now() - startedAt) / 1000; startedAt = null;
          clearInterval(timer); timer = null;
          startBtn.replaceChildren(icon('play'), 'Продовжити');
        } else {
          startedAt = Date.now();
          timer = setInterval(tick, 250);
          startBtn.replaceChildren(icon('stop'), 'Пауза');
        }
      }
      cleanups.push(() => { clearInterval(timer); timer = null; });
      return [
        h('div', { class: 'eyebrow' }, 'Contemplatio'),
        h('h2', { class: 'day-title' }, 'Хвилина тиші'),
        h('p', { class: 'intro' }, 'Нічого не треба робити. Просто побудь із Богом, Який поруч. Якщо думки відволікають — повернися до свого слова.'),
        h('div', { class: 'timer' }, ring, time),
        h('div', { class: 'deck-nav' }, h('button', { class: 'btn ghost', onclick: () => go(step - 1) }, 'Назад'), startBtn),
        h('div', { style: { textAlign: 'center', marginTop: '12px' } }, finishBtn),
      ];
    },
  ];

  function draw() {
    stopSpeaking();
    cleanups.splice(0).forEach((fn) => fn());
    card.replaceChildren(...builders[step]().filter(Boolean));
    tabs.forEach((t, i) => { t.classList.toggle('active', i === step); t.classList.toggle('past', i < step); });
  }
  function go(i) {
    if (i < 0 || i >= STEPS.length) return;
    step = i;
    draw();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function finish() {
    cleanups.splice(0).forEach((fn) => fn());
    const text = [meditation.trim(), prayer.trim()].filter(Boolean).join('\n\n');
    const now = Date.now();
    await journal.put({
      id: `lectio:${now}`, type: 'lectio', book: id, ref, title: 'Повільне читання', words: chosenText(),
      text: text || '', meditation: meditation.trim(), prayer: prayer.trim(), link: `#/lectio/${id}/${c}/${a}-${b}`,
      created: now, updated: now, date: todayKey(),
    }).catch(() => toast('Не вдалося зберегти в щоденник'));
    logActivity('lectio');
    card.replaceChildren(
      h('div', { class: 'done-card', style: { padding: '8px 0' } },
        h('div', { class: 'done-icon' }, icon('check')),
        h('div', { class: 'eyebrow' }, 'Повільне читання завершено'),
        h('h2', {}, 'Нехай це слово залишиться з тобою'),
        chosenText() ? h('blockquote', { class: 'chosen-big' }, chosenText()) : null,
        h('p', {}, 'Спробуй згадати його кілька разів протягом дня — у дорозі, перед сном.'),
        h('div', { class: 'btn-row center' },
          h('a', { class: 'btn ghost small', href: '#/journal' }, 'До щоденника'),
          h('a', { class: 'btn small', href: '#/today' }, 'На головну'))));
  }

  draw();
  const el = h('div', { class: 'view-enter' },
    h('header', { class: 'book-head' },
      h('a', { class: 'icon-btn', href: '#/lectio', 'aria-label': 'Назад' }, icon('back')),
      h('div', { class: 'titles' }, h('div', { class: 'eyebrow' }, 'Повільне читання'), h('h1', { class: 'h1' }, ref))),
    h('div', { class: 'steps five' }, tabs),
    card);

  return { el, tab: 'today', title: `Lectio · ${ref}`, destroy: () => { stopSpeaking(); cleanups.splice(0).forEach((fn) => fn()); } };
}

// М'який дзвіночок наприкінці тиші
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.25);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.25 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.25 + 2.4);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.25); o.stop(ctx.currentTime + i * 0.25 + 2.5);
    });
    navigator.vibrate?.(120);
  } catch { /* без звуку */ }
}
