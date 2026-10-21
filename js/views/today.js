import { h, icon, rerender } from '../ui.js';
import { state } from '../store.js';
import { loadBooks, book, chapterTitle } from '../bible.js';
import { activePlan, nextDay, doneTodayKey, doneCount, getDay } from '../plans/index.js';
import { streakInfo, dismissWelcome, REST_DAYS } from '../progress.js';
import { plural } from '../ui.js';
import { dayDeck, doneCard, verseOfDayCard } from './daily.js';

// Якщо сьогоднішній день уже прочитано, а людина хоче читати далі — тримаємо це до перезавантаження
let readAhead = false;
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

export async function render() {
  await loadBooks();
  const meta = activePlan();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 5 ? 'Тихої ночі' : hour < 12 ? 'Доброго ранку' : hour < 18 ? 'Доброго дня' : 'Доброго вечора';
  const date = now.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });

  const daily = meta.kind === 'daily';
  const count = doneCount(meta);
  const next = nextDay(meta);
  const doneToday = doneTodayKey(meta);
  const showDone = doneToday != null && (daily || !readAhead || next == null);
  const key = showDone ? doneToday : (next ?? meta.length);
  const info = streakInfo(now);

  const el = h('div', { class: 'view-enter today' });
  let deck = null;

  el.append(h('header', { class: 'page-head' },
    h('div', { class: 'eyebrow' }, date),
    h('h1', {}, greeting)));

  // «Раді, що ти повернувся» — замість докорів за пропущені дні
  if (info.welcomeBack) {
    el.append(h('div', { class: 'card welcome' },
      h('button', { class: 'icon-btn close', 'aria-label': 'Закрити', onclick: (e) => { dismissWelcome(); e.currentTarget.closest('.welcome').remove(); } }, icon('close')),
      h('div', { class: 'eyebrow' }, 'Вітаємо знову'),
      h('h2', {}, 'Раді, що ти повернувся'),
      h('p', {}, 'Неважливо, скільки минуло часу, — Слово чекало на тебе. Продовжимо з того місця, де ти зупинився, без поспіху.')));
  }

  // Тиждень і м'яка серія
  el.append(h('a', { class: 'week-strip', href: '#/progress', 'aria-label': 'Мій прогрес' },
    h('div', { class: 'days' }, info.week.map((d, i) => h('span', { class: `d ${d.status}`, title: d.key },
      h('small', {}, WD[i]), h('i', {}, d.status === 'read' ? icon('check') : d.date.getDate())))),
    h('div', { class: 'streak' },
      h('strong', {}, info.streak),
      h('small', {}, `${plural(info.streak, ['день', 'дні', 'днів'])} поспіль`),
      h('small', { class: 'rest' }, `відпочинок: ${info.restLeft} з ${REST_DAYS}`))));

  el.append(h('a', { class: 'plan-strip', href: '#/plans' },
    h('div', { class: 'plan-strip-text' },
      h('strong', {}, meta.title),
      h('span', {}, daily ? (state.plans.churchCalendar === 'old' ? 'юліанський календар' : 'новоюліанський календар')
        : next == null ? 'Завершено' : `День ${key} з ${meta.length}`)),
    !daily ? h('div', { class: 'progress' }, h('i', { style: { width: `${Math.round((count / meta.length) * 100)}%` } })) : null));

  const main = h('div');
  el.append(main);

  let day = null;
  if (showDone || (!daily && next == null)) {
    main.append(await doneCard(meta, key, { onAhead: () => { readAhead = true; rerender(); } }));
    day = await getDay(meta, key).catch(() => null);
  } else {
    day = await getDay(meta, key);
    deck = await dayDeck(meta, day, { onComplete: () => { readAhead = false; rerender(); } });
    main.append(deck.el);
  }

  const vod = await verseOfDayCard(deck?.day || day).catch(() => null);
  if (vod) el.append(vod);

  el.append(h('div', { class: 'quick' },
    h('a', { class: 'quick-link', href: '#/lectio' }, icon('moon'), h('span', {}, h('strong', {}, 'Повільне читання'), h('small', {}, 'Lectio Divina · 10 хв'))),
    h('a', { class: 'quick-link', href: '#/search' }, icon('search'), h('span', {}, h('strong', {}, 'Пошук'), h('small', {}, 'за словом у Біблії')))));

  const last = state.last && book(state.last.id) ? state.last : null;
  if (last) {
    el.append(h('a', { class: 'continue-chip subtle', href: `#/read/${last.id}/${last.n}` },
      icon('bible'),
      h('div', { style: { flex: '1' } }, h('small', {}, 'Вільне читання Біблії'), h('strong', {}, chapterTitle(last.id, last.n))),
      icon('next')));
  }

  return { el, tab: 'today', destroy: () => deck?.destroy() };
}
