import { h, icon, plural } from '../ui.js';
import { state, parseKey } from '../store.js';
import { loadBooks } from '../bible.js';
import { streakInfo, monthGrid, ACHIEVEMENTS, bookProgress, checkAchievements, REST_DAYS } from '../progress.js';

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

export async function render() {
  await loadBooks();
  checkAchievements({ silent: true });
  const info = streakInfo();
  const now = new Date();
  let y = now.getFullYear(), m = now.getMonth();

  const title = h('strong', { class: 'cal-title' });
  const grid = h('div', { class: 'cal-grid', role: 'grid' });
  function drawMonth() {
    const label = new Date(y, m, 1).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
    title.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    grid.replaceChildren(
      ...WD.map((d) => h('span', { class: 'cal-wd' }, d)),
      ...monthGrid(y, m).map((c) => h('span', {
        class: ['cal-day', !c.inMonth && 'out', c.active && 'active', c.today && 'today', c.future && 'future'].filter(Boolean).join(' '),
        title: c.key,
      }, c.day)));
  }
  drawMonth();
  const shift = (d) => { m += d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } drawMonth(); };

  const readDays = Object.keys(state.activity).length;
  const books = bookProgress();
  const finishedBooks = books.filter((b) => b.done).length;

  const el = h('div', { class: 'view-enter' },
    h('header', { class: 'book-head' },
      h('a', { class: 'icon-btn', href: '#/plans', 'aria-label': 'Назад' }, icon('back')),
      h('div', { class: 'titles' }, h('div', { class: 'eyebrow' }, 'Без поспіху'), h('h1', { class: 'h1' }, 'Мій прогрес'))),

    h('div', { class: 'stats' },
      stat(info.streak, `${plural(info.streak, ['день', 'дні', 'днів'])} поспіль`),
      stat(readDays, `${plural(readDays, ['день', 'дні', 'днів'])} читання`),
      stat(Object.keys(state.read).length, 'розділів')),

    h('div', { class: 'card soft-note' },
      icon('leaf'),
      h('p', {}, `Мʼяка серія: щотижня є ${REST_DAYS} дні відпочинку, тож пропуск не обнуляє її. `,
        `Цього тижня залишилось ${info.restLeft} з ${REST_DAYS}. Головне не серія, а зустріч зі Словом.`)),

    h('div', { class: 'card calendar' },
      h('div', { class: 'cal-head' },
        h('button', { class: 'icon-btn', 'aria-label': 'Попередній місяць', onclick: () => shift(-1) }, icon('back')),
        title,
        h('button', { class: 'icon-btn', 'aria-label': 'Наступний місяць', onclick: () => shift(1) }, icon('next'))),
      grid,
      h('div', { class: 'cal-legend' }, h('span', { class: 'lg active' }), 'день із читанням', h('span', { class: 'lg today' }), 'сьогодні')),

    h('h2', { class: 'section-title' }, 'Досягнення'),
    h('div', { class: 'ach-grid' }, ACHIEVEMENTS.map((a) => {
      const got = state.achievements[a.id];
      return h('div', { class: `ach${got ? ' got' : ''}` },
        h('span', { class: 'ach-icon' }, icon(got ? a.icon : 'award')),
        h('strong', {}, a.title),
        h('small', {}, got ? `${a.desc} · ${parseKey(got).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}` : a.desc));
    })),

    h('h2', { class: 'section-title' }, `Книги Біблії · прочитано повністю: ${finishedBooks}`),
    h('ul', { class: 'book-list book-progress' }, books.filter((b) => b.read > 0).sort((a, b) => b.read / b.total - a.read / a.total).map((b) =>
      h('li', {}, h('a', { href: `#/bible/${b.book.id}` },
        h('span', { class: 'name' }, b.book.short, b.done ? h('span', { class: 'done-mark' }, icon('check')) : null),
        h('span', { class: 'bp' }, h('span', { class: 'progress' }, h('i', { style: { width: `${Math.round((b.read / b.total) * 100)}%` } })),
          h('small', {}, `${b.read}/${b.total}`)))))),
    books.some((b) => b.read) ? null : h('p', { class: 'hint', style: { padding: '0 4px' } }, 'Тут зʼявляться книги, які ти читаєш: розділ позначається прочитаним, коли дочитуєш його до кінця.'));

  return { el, tab: 'plans', title: 'Мій прогрес' };
}

const stat = (n, label) => h('div', { class: 'stat' }, h('strong', {}, n), h('small', {}, label));
