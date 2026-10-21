import { h } from './ui.js';
import { state } from './store.js';
import { stripAccents, loadBook } from './bible.js';

// Спільний рендер віршів для читання розділу й щоденного уривка.
// items: [{ c, v, t }]. Якщо уривок переходить у новий розділ, номер вірша показуємо як «3:1».
// fr — Map('c:v' → текст Louis Segond), marks — Map('c:v' → { color, bookmark, note }).
export function buildVerses(items, { poetic = false, isSelected = () => false, fr = null, marks = null } = {}) {
  const s = state.settings;
  const fmt = s.accents ? (t) => t : stripAccents;
  const firstC = items[0]?.c;
  const verseEl = ({ c, v, t }) => {
    const m = marks?.get(`${c}:${v}`);
    const cls = ['v', isSelected(v, c) && 'sel', m?.color && `hl-${m.color}`].filter(Boolean).join(' ');
    return h('span', { class: cls, 'data-v': v, 'data-c': c },
      h('span', { class: 'vn' }, c !== firstC && v === 1 ? `${c}:1` : v),
      m?.bookmark ? h('span', { class: 'mk mk-bm', 'aria-label': 'Закладка' }) : null,
      fmt(t),
      m?.note ? h('span', { class: 'mk mk-note', title: m.note, 'aria-label': 'Є нотатка' }) : null,
      ' ');
  };

  const frag = document.createDocumentFragment();
  if (fr) {
    // Паралельний текст: кожен вірш — пара рядків (на широкому екрані — дві колонки)
    items.forEach((it) => frag.append(h('div', { class: 'pv' },
      verseEl(it),
      h('span', { class: 'fr', lang: 'fr' }, h('span', { class: 'vn' }, it.v), fr.get(`${it.c}:${it.v}`) || ''))));
    return frag;
  }
  if (s.layout === 'lines') {
    frag.append(h('p', {}, items.map(verseEl)));
  } else if (poetic) {
    items.forEach((it) => frag.append(h('p', { class: 'poem' }, verseEl(it))));
  } else {
    // Абзаців у тексті немає, тож ділимо м'яко: після завершеного речення, коли абзац уже чималий
    let p = h('p'), len = 0;
    items.forEach((it, i) => {
      if (i > 0 && it.c !== items[i - 1].c && p.childNodes.length) { frag.append(p); p = h('p'); len = 0; }
      p.append(verseEl(it));
      len += it.t.length;
      if (len > 420 && /[.!?…“»]\s*$/.test(it.t) && i < items.length - 1) {
        frag.append(p); p = h('p'); len = 0;
      }
    });
    frag.append(p);
  }
  return frag;
}

export function readerClasses(el) {
  el.classList.toggle('lines', state.settings.layout === 'lines');
  el.classList.toggle('no-nums', !state.settings.verseNumbers);
  el.classList.toggle('parallel', !!state.settings.parallel);
}

// Французький текст для тих самих віршів (нумерація збігається)
export async function frenchFor(id, items) {
  if (!state.settings.parallel || !items.length) return null;
  try {
    const data = await loadBook(id, 'fr');
    return new Map(items.map(({ c, v }) => [`${c}:${v}`, data[c - 1]?.[v - 1] || '']));
  } catch {
    return null;
  }
}
