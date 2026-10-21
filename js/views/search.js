import { h, icon, plural } from '../ui.js';
import { loadBooks, books, loadBook, stripAccents } from '../bible.js';

const MAX = 300;
let lastQuery = '';
let lastScope = 'all';

// Нормалізація для пошуку: без наголосів, регістру й різниці в апострофах
const norm = (s) => stripAccents(s).toLowerCase().replace(/[’'ʼ`]/g, 'ʼ').replace(/ґ/g, 'г');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function render() {
  await loadBooks();
  const input = h('input', {
    type: 'search', class: 'search-input', placeholder: 'Слово або фраза: милосердя, хліб життя…',
    'aria-label': 'Пошук у Біблії', value: lastQuery, enterkeyhint: 'search', autocomplete: 'off',
  });
  const scopes = [['all', 'Уся Біблія'], ['ot', 'Старий Завіт'], ['nt', 'Новий Завіт']];
  const seg = h('div', { class: 'segmented' }, scopes.map(([k, label]) => h('button', {
    'aria-pressed': String(lastScope === k),
    onclick: (e) => { lastScope = k; seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); run(); },
  }, label)));
  const status = h('p', { class: 'search-status', 'aria-live': 'polite' });
  const results = h('div', { class: 'search-results' });
  let token = 0, timer = null;

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 350); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(timer); run(); input.blur(); } });

  async function run() {
    const q = input.value.trim();
    lastQuery = q;
    const my = ++token;
    results.replaceChildren();
    if (q.length < 2) { status.textContent = 'Введи щонайменше дві літери.'; return; }
    const terms = norm(q).split(/\s+/).filter(Boolean);
    const phrase = norm(q);
    const list = books().filter((b) => lastScope === 'all' || (lastScope === 'nt') === b.nt);
    let found = 0, total = 0;
    const groups = new Map();

    for (const b of list) {
      if (my !== token) return;
      status.textContent = `Шукаю… ${b.short}`;
      let data;
      try { data = await loadBook(b.id); } catch { continue; }
      data.forEach((chap, ci) => chap.forEach((t, vi) => {
        const n = norm(t);
        if (!terms.every((w) => n.includes(w))) return;
        total++;
        if (found >= MAX) return;
        found++;
        if (!groups.has(b.id)) groups.set(b.id, { b, items: [] });
        groups.get(b.id).items.push({ c: ci + 1, v: vi + 1, t, exact: n.includes(phrase) });
      }));
    }
    if (my !== token) return;
    status.textContent = total
      ? `${total} ${plural(total, ['вірш', 'вірші', 'віршів'])}${total > MAX ? ` · показано перші ${MAX}` : ''}`
      : 'Нічого не знайдено. Спробуй іншу форму слова — наприклад, «милосерд» замість «милосердя».';

    const re = new RegExp(`(${terms.map(escapeRe).join('|')})`, 'gi');
    const sections = [...groups.values()].map(({ b, items }) => ({ title: `${b.short} · ${items.length}`, b, items }));
    // Для кількох слів спершу показуємо точні збіги фрази
    if (terms.length > 1) {
      const exact = sections.flatMap(({ b, items }) => items.filter((it) => it.exact).map((it) => ({ ...it, b })));
      if (exact.length) sections.unshift({ title: `Точна фраза · ${exact.length}`, items: exact });
    }
    for (const { title, b: sb, items } of sections) {
      results.append(h('h2', { class: 'section-title' }, title),
        h('ul', { class: 'result-list' }, items.map((it) => {
          const b = it.b || sb;
          const plain = stripAccents(it.t);
          const normPlain = norm(plain);
          // Підсвічуємо за позиціями в нормалізованому рядку (довжина та сама, бо наголоси вже прибрано)
          const parts = [];
          let last = 0;
          for (const m of normPlain.matchAll(re)) {
            parts.push(plain.slice(last, m.index), h('mark', {}, plain.slice(m.index, m.index + m[0].length)));
            last = m.index + m[0].length;
          }
          parts.push(plain.slice(last));
          return h('li', {}, h('a', { href: `#/read/${b.id}/${it.c}/${it.v}` },
            h('span', { class: 'ref' }, `${b.abbr} ${it.c}:${it.v}`), h('span', { class: 'txt' }, parts)));
        })));
    }
  }

  const el = h('div', { class: 'view-enter' },
    h('header', { class: 'page-head' },
      h('div', { class: 'eyebrow' }, 'Біблія'),
      h('h1', {}, 'Пошук')),
    h('div', { class: 'search-box' }, icon('search'), input),
    seg, status, results);

  if (lastQuery) setTimeout(run, 0);
  return { el, tab: 'bible', title: 'Пошук', mounted: () => { if (!lastQuery) input.focus(); } };
}
