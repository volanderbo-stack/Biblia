import { h, icon, plural } from '../ui.js';
import { state } from '../store.js';
import { loadBooks, book, books, loadBook, stripAccents } from '../bible.js';
import { verseMarks, updateMark } from '../db.js';

const COLOR_NAMES = { yellow: 'Жовтий', green: 'Зелений', blue: 'Блакитний', pink: 'Рожевий' };
let tab = 'bookmark';

// Закладки й виділені вірші
export async function render() {
  await loadBooks();
  const all = await verseMarks.all().catch(() => []);
  const order = new Map(books().map((b, i) => [b.id, i]));
  all.sort((a, b) => (order.get(a.book) - order.get(b.book)) || a.c - b.c || a.v - b.v);

  const texts = new Map();
  await Promise.all([...new Set(all.map((m) => m.book))].map(async (id) => texts.set(id, await loadBook(id).catch(() => []))));
  const fmt = state.settings.accents ? (t) => t : stripAccents;

  const tabs = [['bookmark', 'Закладки'], ['color', 'Виділення'], ['note', 'Нотатки']];
  const count = (k) => all.filter((m) => m[k]).length;
  const seg = h('div', { class: 'segmented' }, tabs.map(([k, label]) => h('button', {
    'aria-pressed': String(tab === k),
    onclick: (e) => { tab = k; seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); draw(); },
  }, `${label} · ${count(k)}`)));
  const list = h('div');

  function draw() {
    const items = all.filter((m) => m[tab]);
    if (!items.length) {
      list.replaceChildren(h('div', { class: 'card soon' }, icon(tab === 'bookmark' ? 'bookmark' : tab === 'note' ? 'note' : 'marker'),
        h('h2', {}, tab === 'bookmark' ? 'Закладок поки немає' : tab === 'note' ? 'Нотаток поки немає' : 'Виділених віршів поки немає'),
        h('p', {}, 'Під час читання торкнися вірша — внизу зʼявиться панель: кольори, закладка, нотатка.')));
      return;
    }
    list.replaceChildren(h('ul', { class: 'mark-list' }, items.map((m) => {
      const b = book(m.book);
      const t = texts.get(m.book)?.[m.c - 1]?.[m.v - 1] || '';
      const remove = h('button', {
        class: 'icon-btn', 'aria-label': 'Прибрати',
        onclick: async (e) => {
          e.preventDefault();
          const li = e.currentTarget.closest('li');
          await updateMark(m.book, m.c, m.v, { [tab]: tab === 'bookmark' ? false : null });
          m[tab] = null;
          li.remove();
        },
      }, icon('trash'));
      return h('li', { class: m.color ? `hl-${m.color}` : '' }, h('a', { href: `#/read/${m.book}/${m.c}/${m.v}` },
        h('div', { class: 'mark-head' },
          h('strong', {}, `${b.short} ${m.c}:${m.v}`),
          m.color ? h('span', { class: `swatch hl-${m.color}`, title: COLOR_NAMES[m.color] }) : null,
          remove),
        h('p', { class: 'mark-text' }, fmt(t)),
        m.note && tab === 'note' ? h('p', { class: 'mark-note' }, m.note) : null));
    })));
  }
  draw();

  const el = h('div', { class: 'view-enter' },
    h('header', { class: 'page-head' },
      h('div', { class: 'eyebrow' }, 'Мої позначки'),
      h('h1', {}, 'Закладки й виділення'),
      h('p', {}, `${all.length} ${plural(all.length, ['позначений вірш', 'позначені вірші', 'позначених віршів'])}`)),
    seg, list);
  return { el, tab: 'bible', title: 'Закладки' };
}
