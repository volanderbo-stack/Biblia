import { h, icon, plural } from '../ui.js';
import { state, isRead } from '../store.js';
import { loadBooks, book } from '../bible.js';
import { BOOK_INFO } from '../books-info.js';

// Книга → сітка розділів
export async function render({ id }) {
  await loadBooks();
  const b = book(id);
  if (!b) { location.replace('#/bible'); return null; }

  const total = b.verses.length;
  const readCount = b.verses.filter((_, i) => isRead(id, i + 1)).length;
  const current = state.last?.id === id ? state.last.n : null;

  const el = h('div', { class: 'view-enter' },
    h('header', { class: 'book-head' },
      h('a', { class: 'icon-btn', href: '#/bible', 'aria-label': 'До списку книг' }, icon('back')),
      h('div', { class: 'titles' },
        h('div', { class: 'eyebrow' }, b.nt ? 'Новий Завіт' : 'Старий Завіт'),
        h('h1', { class: 'h1' }, b.name),
        h('p', { style: { color: 'var(--text-3)', margin: '6px 0 0', fontSize: '14px' } },
          `${total} ${plural(total, ['розділ', 'розділи', 'розділів'])}`,
          readCount ? ` · прочитано ${readCount}` : ''))),
    BOOK_INFO[id] ? h('details', { class: 'book-intro card' }, h('summary', {}, 'Про книгу'), h('p', {}, BOOK_INFO[id].intro)) : null,
    h('h2', { class: 'section-title' }, id === 'PSA' ? 'Псалми' : 'Розділи'),
    h('ul', { class: 'chapter-grid' }, b.verses.map((_, i) => {
      const n = i + 1;
      const cls = [isRead(id, n) && 'read', current === n && 'current'].filter(Boolean).join(' ');
      return h('li', {}, h('a', { href: `#/read/${id}/${n}`, class: cls || null, 'aria-label': `Розділ ${n}` }, n));
    })));

  return { el, tab: 'bible', title: b.short };
}
