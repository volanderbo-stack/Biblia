import { h, icon, plural } from '../ui.js';
import { state, save, isRead } from '../store.js';
import { loadBooks, books, book, GROUPS, chapterTitle } from '../bible.js';

// Біблія: Завіт → список книг за розділами
export async function render() {
  await loadBooks();
  const el = h('div', { class: 'view-enter' });

  el.append(h('header', { class: 'page-head with-tools' },
    h('div', {},
      h('div', { class: 'eyebrow' }, 'Святе Письмо'),
      h('h1', {}, 'Біблія'),
      h('p', {}, 'Переклад Івана Огієнка')),
    h('div', { class: 'head-tools' },
      h('a', { class: 'icon-btn', href: '#/search', 'aria-label': 'Пошук' }, icon('search')),
      h('a', { class: 'icon-btn', href: '#/marks', 'aria-label': 'Закладки й виділення' }, icon('bookmark')))));

  const last = state.last && book(state.last.id) ? state.last : null;
  if (last) {
    el.append(h('a', { class: 'continue-chip', href: `#/read/${last.id}/${last.n}` },
      icon('bible'),
      h('div', { style: { flex: '1' } }, h('small', {}, 'Продовжити читання'), h('strong', {}, chapterTitle(last.id, last.n))),
      icon('next')));
  }

  const tabs = [['ot', 'Старий Завіт'], ['nt', 'Новий Завіт']];
  const listWrap = h('div');
  const seg = h('div', { class: 'segmented', role: 'tablist' }, tabs.map(([key, label]) =>
    h('button', {
      role: 'tab', 'aria-pressed': String(state.testament === key),
      onclick: () => {
        state.testament = key; save();
        seg.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(tabs[i][0] === key)));
        draw();
      },
    }, label)));
  el.append(seg, listWrap);

  function draw() {
    const nt = state.testament === 'nt';
    const groups = new Map();
    for (const b of books()) {
      if (b.nt !== nt) continue;
      if (!groups.has(b.group)) groups.set(b.group, []);
      groups.get(b.group).push(b);
    }
    listWrap.replaceChildren(...[...groups].flatMap(([g, items]) => [
      h('h2', { class: 'section-title' }, GROUPS[g]),
      h('ul', { class: 'book-list' }, items.map((b) => {
        const total = b.verses.length;
        const started = b.verses.some((_, i) => isRead(b.id, i + 1));
        return h('li', {}, h('a', { href: total === 1 ? `#/read/${b.id}/1` : `#/bible/${b.id}` },
          h('span', { class: 'name' }, b.short),
          started ? h('span', { class: 'progress-dot', title: 'Ви вже читали цю книгу' }) : null,
          h('span', { class: 'meta' }, `${total} ${plural(total, ['розділ', 'розділи', 'розділів'])}`)));
      })),
    ]));
  }
  draw();

  return { el, tab: 'bible', title: 'Біблія' };
}
