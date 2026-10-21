import { h, icon } from '../ui.js';
import { loadBooks, book } from '../bible.js';
import { journal, verseMarks } from '../db.js';
import { PLAN_LIST } from '../plans/index.js';

const filters = { kind: 'all', plan: '', book: '' };

// Щоденник: роздуми з кроку «Подумай», повільні читання і нотатки до віршів — за датами
export async function render() {
  await loadBooks();
  const [entries, marks] = await Promise.all([journal.all().catch(() => []), verseMarks.all().catch(() => [])]);
  const notes = marks.filter((m) => m.note).map((m) => ({
    id: `note:${m.id}`, type: 'note', book: m.book, title: 'Нотатка до вірша',
    ref: m.noteRef || `${book(m.book)?.abbr} ${m.c}:${m.v}`, quote: m.noteText, text: m.note,
    updated: m.updated, link: `#/read/${m.book}/${m.c}/${m.v}`,
  }));
  const all = [...entries.filter((e) => e.text || e.words), ...notes].sort((a, b) => b.updated - a.updated);

  const head = h('header', { class: 'page-head' },
    h('div', { class: 'eyebrow' }, 'Щоденник'),
    h('h1', {}, 'Твої думки'));

  if (!all.length) {
    return {
      el: h('div', { class: 'view-enter' }, head,
        h('div', { class: 'card soon' },
          icon('journal'),
          h('h2', {}, 'Тут збиратимуться твої роздуми'),
          h('p', {}, 'Усе, що ти запишеш на кроці «Подумай», під час повільного читання чи як нотатку до вірша, зʼявиться тут — за датами.'),
          h('p', {}, h('a', { class: 'btn', href: '#/today', style: { marginTop: '14px' } }, 'До сьогоднішнього читання')))),
      tab: 'journal', title: 'Щоденник',
    };
  }

  // ── Фільтри
  const kinds = [['all', 'Усе'], ['reflection', 'Роздуми'], ['lectio', 'Lectio'], ['note', 'Нотатки']];
  const kindSeg = h('div', { class: 'chips' }, kinds.map(([k, label]) => h('button', {
    class: 'chip', 'aria-pressed': String(filters.kind === k),
    onclick: (e) => { filters.kind = k; kindSeg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); draw(); },
  }, label)));
  const usedPlans = [...new Set(all.map((e) => e.plan).filter(Boolean))];
  const usedBooks = [...new Set(all.map((e) => e.book).filter(Boolean))].sort((a, b) => book(a).index - book(b).index);
  const planSel = h('select', { class: 'select', 'aria-label': 'План', onchange: (e) => { filters.plan = e.target.value; draw(); } },
    h('option', { value: '' }, 'Усі плани'),
    usedPlans.map((id) => h('option', { value: id, selected: filters.plan === id }, PLAN_LIST.find((p) => p.id === id)?.title || id)));
  const bookSel = h('select', { class: 'select', 'aria-label': 'Книга', onchange: (e) => { filters.book = e.target.value; draw(); } },
    h('option', { value: '' }, 'Усі книги'),
    usedBooks.map((id) => h('option', { value: id, selected: filters.book === id }, book(id).short)));

  const list = h('div');
  const fmtDay = (ts) => new Date(ts).toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' });
  const fmtMonth = (ts) => new Date(ts).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });

  function draw() {
    const shown = all.filter((e) => (filters.kind === 'all' || e.type === filters.kind)
      && (!filters.plan || e.plan === filters.plan) && (!filters.book || e.book === filters.book));
    if (!shown.length) { list.replaceChildren(h('p', { class: 'hint', style: { padding: '20px 4px' } }, 'За цими фільтрами записів немає.')); return; }
    const out = [];
    let month = null;
    for (const e of shown) {
      const m = fmtMonth(e.updated);
      if (m !== month) { out.push(h('h2', { class: 'section-title' }, m)); month = m; }
      const href = e.link || (e.plan ? `#/plan/${e.plan}/${e.day}` : '#/journal');
      out.push(h('a', { class: `card link journal-entry kind-${e.type}`, href },
        h('div', { class: 'eyebrow' }, `${fmtDay(e.updated)} · ${e.type === 'lectio' ? 'Повільне читання' : e.type === 'note' ? 'Нотатка' : (e.planTitle || 'Роздум')}`),
        h('h2', {}, e.title || 'Запис'),
        e.ref ? h('div', { class: 'refs' }, e.ref) : null,
        e.quote ? h('blockquote', { class: 'note-quote' }, e.quote) : null,
        e.words ? h('p', { class: 'entry-words' }, 'Слово: ', h('strong', {}, e.words)) : null,
        e.text ? h('p', { class: 'entry-text' }, e.text) : null));
    }
    list.replaceChildren(...out);
  }
  draw();

  const el = h('div', { class: 'view-enter' }, head,
    h('div', { class: 'journal-filters' }, kindSeg,
      h('div', { class: 'selects' }, usedPlans.length ? planSel : null, usedBooks.length ? bookSel : null)),
    list);
  return { el, tab: 'journal', title: 'Щоденник' };
}

