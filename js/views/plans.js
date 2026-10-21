import { h, icon, toast, rerender, plural } from '../ui.js';
import { state, save, todayKey } from '../store.js';
import { loadBooks, rangeLabel } from '../bible.js';
import { PLAN_LIST, activePlan, setActivePlan, isDone, doneCount, nextDay, dayList, getDay } from '../plans/index.js';
import { streakInfo } from '../progress.js';
import { dayDeck, doneCard } from './daily.js';

// Плани: вибір плану, прогрес і список днів
export async function render() {
  await loadBooks();
  const meta = activePlan();
  const info = streakInfo();

  const el = h('div', { class: 'view-enter' },
    h('header', { class: 'page-head' },
      h('div', { class: 'eyebrow' }, 'Плани читання'),
      h('h1', {}, 'Читати потроху, але щодня'),
      h('p', {}, 'Невеликий уривок, роздум і молитва. Пропущений день нічого не зламає: план просто чекає на тебе.')));

  el.append(h('a', { class: 'card link progress-card', href: '#/progress' },
    h('div', { class: 'pc-num' }, h('strong', {}, info.streak), h('small', {}, `${plural(info.streak, ['день', 'дні', 'днів'])} поспіль`)),
    h('div', { class: 'pc-txt' }, h('strong', {}, 'Мій прогрес'), h('small', {}, `Календар, досягнення, прочитані книги · усього днів: ${info.totalDays}`)),
    icon('next')));

  // Активний план
  el.append(h('h2', { class: 'section-title' }, 'Твій план'), await activeCard(meta));

  // Інші плани
  el.append(h('h2', { class: 'section-title' }, 'Інші плани'),
    ...PLAN_LIST.filter((p) => p.id !== meta.id).map((p) => {
      const count = doneCount(p);
      return h('div', { class: 'card plan-card' },
        h('div', { class: 'eyebrow' }, p.recommended ? `${p.subtitle} · рекомендовано` : p.subtitle),
        h('h2', {}, p.title),
        h('p', {}, p.description),
        count && p.kind === 'seq' ? h('p', { class: 'progress-label' }, `Уже прочитано ${count} з ${p.length}`) : null,
        h('button', {
          class: 'btn small', style: { marginTop: '14px' },
          onclick: () => { setActivePlan(p.id); toast(`Обрано план «${p.title}»`); location.hash = '#/today'; },
        }, count ? 'Продовжити цей план' : 'Обрати цей план'));
    }));

  // Список днів активного плану
  if (meta.kind === 'seq') {
    const list = await dayList(meta);
    const next = nextDay(meta);
    el.append(h('h2', { class: 'section-title' }, 'Дні'),
      h('ol', { class: 'day-list' }, list.map((d, i) => {
        const n = i + 1;
        const done = isDone(meta, n);
        return h('li', {}, h('a', { href: `#/plan/${meta.id}/${n}`, class: [done && 'done', n === next && 'next'].filter(Boolean).join(' ') || null },
          h('span', { class: 'num' }, done ? icon('check') : n),
          h('span', { class: 'txt' }, h('strong', {}, d.title), h('small', {}, d.refs))));
      })));
  }

  return { el, tab: 'plans', title: 'Плани' };
}

async function activeCard(meta) {
  const count = doneCount(meta);
  const next = nextDay(meta);
  const card = h('div', { class: 'card hero' },
    h('div', { class: 'eyebrow' }, meta.subtitle),
    h('h2', {}, meta.title),
    h('p', {}, meta.description));

  if (meta.kind === 'seq') {
    card.append(
      h('div', { class: 'progress' }, h('i', { style: { width: `${Math.round((count / meta.length) * 100)}%` } })),
      h('p', { class: 'progress-label' }, count ? `Прочитано ${count} з ${meta.length}` : `${meta.length} днів`),
      next ? h('a', { class: 'btn', href: '#/today', style: { marginTop: '14px' } }, count ? `Продовжити · день ${next}` : 'Почати', icon('next')) : null);
  } else {
    const cal = state.plans.churchCalendar;
    const seg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Календар' },
      [['new', 'Новоюліанський'], ['old', 'Юліанський']].map(([v, label]) => h('button', {
        role: 'radio', 'aria-pressed': String(cal === v),
        onclick: () => { state.plans.churchCalendar = v; save(true); rerender(); },
      }, label)));
    const today = await getDay(meta, todayKey()).catch(() => null);
    card.append(
      h('div', { class: 'setting', style: { padding: '14px 0 0' } },
        h('div', { class: 'label' }, 'Календар'),
        seg,
        h('p', { class: 'hint' }, cal === 'new'
          ? 'Новоюліанський календар з 1 вересня 2023 року використовують ПЦУ та УГКЦ: нерухомі свята — за новим стилем (Різдво 25 грудня).'
          : 'Юліанський (старий стиль): нерухомі свята на 13 днів пізніше (Різдво 7 січня за цивільним календарем).')),
      today ? h('div', { class: 'tomorrow', style: { margin: '16px 0 0', maxWidth: 'none' } },
        h('small', {}, `Сьогодні · ${today.title}`),
        h('strong', {}, today.readings.map((r) => `${r.label}: ${r.segs.map(([id, range]) => rangeLabel(id, range)).join('; ')}`).join(' · ') || 'Окремих читань немає')) : null,
      h('a', { class: 'btn', href: '#/today', style: { marginTop: '14px' } }, 'Читати сьогодні', icon('next')),
      h('p', { class: 'progress-label' }, `Днів із церковними читаннями: ${count}`));
  }
  return card;
}

// Окремий день плану: #/plan/mark30/5 або #/plan/church/2026-10-21
export async function renderDay({ id, key }) {
  await loadBooks();
  const meta = PLAN_LIST.find((p) => p.id === id);
  const k = meta?.kind === 'seq' ? +key : key;
  if (!meta || (meta.kind === 'seq' && !(k >= 1 && k <= meta.length))) { location.replace('#/plans'); return null; }

  const day = await getDay(meta, k);
  const main = h('div');
  const el = h('div', { class: 'view-enter' },
    h('header', { class: 'book-head' },
      h('a', { class: 'icon-btn', href: '#/plans', 'aria-label': 'До плану' }, icon('back')),
      h('div', { class: 'titles' },
        h('div', { class: 'eyebrow' }, meta.title),
        h('h1', { class: 'h1' }, meta.kind === 'seq' ? `День ${k} з ${meta.length}` : day.label))),
    main);

  let deck = await dayDeck(meta, day, {
    onComplete: async () => {
      deck?.destroy(); deck = null;
      main.replaceChildren(await doneCard(meta, k));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });
  main.append(deck.el);

  return { el, tab: 'plans', title: day.label, destroy: () => deck?.destroy() };
}

