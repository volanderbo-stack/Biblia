import { h, icon, openSheet, closeSheet, toast, copyText } from '../ui.js';
import { state, save, onSettings, markRead, isRead } from '../store.js';
import { loadBooks, book, chapter, neighbor, chapterTitle, refLabel, psalmGreek, stripAccents, POETIC } from '../bible.js';
import { textSettingsPanel } from './text-settings.js';
import { buildVerses, readerClasses, frenchFor } from '../text.js';
import { chapterMarks, updateMark } from '../db.js';
import { listenButton, stopSpeaking } from '../tts.js';
import { openShareCard } from '../sharecard.js';

const READ_AFTER_MS = 5000; // розділ вважається прочитаним, якщо дочитали до кінця і пробули хоча б 5 с
const COLORS = [['yellow', 'Жовтий'], ['green', 'Зелений'], ['blue', 'Блакитний'], ['pink', 'Рожевий']];

export async function render({ id, n, verse: focusVerse }) {
  await loadBooks();
  const b = book(id);
  if (!b || !(n >= 1 && n <= b.verses.length)) {
    location.replace(b ? `#/bible/${id}` : '#/bible');
    return null;
  }

  const verses = await chapter(id, n);
  const items = verses.map((t, i) => ({ c: n, v: i + 1, t }));
  let marks = await chapterMarks(id, n);
  let fr = await frenchFor(id, items);
  const openedAt = Date.now();
  const prev = neighbor(id, n, -1);
  const next = neighbor(id, n, 1);
  const title = chapterTitle(id, n);
  const selected = new Set();
  const cleanups = [];

  // ── Верхня панель
  const bar = h('div', { class: 'reader-bar' }, h('div', { class: 'inner' },
    h('a', { class: 'icon-btn', href: `#/bible/${id}`, 'aria-label': 'До розділів книги' }, icon('back')),
    h('button', { class: 'title-btn', onclick: openChapterPicker, 'aria-label': 'Обрати розділ' },
      h('span', {}, title), icon('down')),
    h('a', { class: 'icon-btn', href: '#/search', 'aria-label': 'Пошук' }, icon('search')),
    h('button', { class: 'icon-btn aa', onclick: openTextSheet, 'aria-label': 'Налаштування тексту' }, 'Аа')));

  // ── Текст
  const greek = id === 'PSA' ? psalmGreek(n) : null;
  const body = h('div', { class: 'text' });
  const doneNote = h('div', { class: 'done-note', hidden: !isRead(id, n) }, icon('check'), ' Розділ прочитано');
  const endMark = h('div', { class: 'end-mark' });
  const article = h('article', { class: 'reader view-enter', lang: 'uk' },
    h('header', { class: 'chap-head' },
      h('div', { class: 'book' }, b.name),
      h('div', { class: 'num' }, n),
      greek ? h('div', { class: 'sub' }, `у церковній нумерації — ${greek}`) : null,
      h('div', { class: 'chap-tools' }, listenButton(() => body))),
    body, endMark, doneNote,
    h('nav', { class: 'chap-nav', 'aria-label': 'Сусідні розділи' },
      prev ? navLink(prev, 'prev') : null,
      next ? navLink(next, 'next') : null));

  // ── Панель виділених віршів
  const selRef = h('span', { class: 'ref' });
  const colorRow = h('div', { class: 'sel-colors' },
    COLORS.map(([c, label]) => h('button', { class: `dot hl-${c}`, 'aria-label': `Виділити: ${label}`, onclick: () => applyColor(c) })),
    h('button', { class: 'dot clear', 'aria-label': 'Зняти виділення', onclick: () => applyColor(null) }, icon('close')));
  const selBar = h('div', { class: 'sel-bar', role: 'toolbar', 'aria-label': 'Дії з віршами' },
    h('div', { class: 'sel-top' }, selRef,
      h('button', { onclick: clearSelection, 'aria-label': 'Скасувати виділення' }, icon('close'))),
    colorRow,
    h('div', { class: 'sel-actions' },
      h('button', { onclick: toggleBookmark, 'aria-label': 'Закладка' }, icon('bookmark'), h('small', {}, 'Закладка')),
      h('button', { onclick: editNote, 'aria-label': 'Нотатка' }, icon('note'), h('small', {}, 'Нотатка')),
      h('button', { onclick: copySelected, 'aria-label': 'Копіювати' }, icon('copy'), h('small', {}, 'Копія')),
      h('button', { onclick: shareSelected, 'aria-label': 'Поділитися' }, icon('share'), h('small', {}, 'Поділитися')),
      h('button', { onclick: lectioSelected, 'aria-label': 'Повільне читання' }, icon('moon'), h('small', {}, 'Lectio'))));

  const el = h('div', {}, bar, article, selBar);

  function renderText() {
    readerClasses(article);
    body.replaceChildren(buildVerses(items, { poetic: POETIC.has(id), isSelected: (v) => selected.has(v), fr, marks }));
  }
  renderText();
  cleanups.push(onSettings(async (s) => {
    if (s.parallel && !fr) fr = await frenchFor(id, items);
    if (!s.parallel) fr = null;
    renderText();
  }));

  // ── Виділення віршів дотиком
  body.addEventListener('click', (e) => {
    if (window.getSelection()?.toString()) return;
    const v = e.target.closest('.v');
    if (!v) return;
    const num = +v.dataset.v;
    if (selected.has(num)) selected.delete(num); else selected.add(num);
    body.querySelectorAll(`.v[data-v="${num}"]`).forEach((x) => x.classList.toggle('sel', selected.has(num)));
    updateSelBar();
  });

  const sorted = () => [...selected].sort((a, b) => a - b);
  function updateSelBar() {
    selBar.classList.toggle('show', selected.size > 0);
    if (selected.size) selRef.textContent = refLabel(id, n, sorted());
  }
  function clearSelection() {
    selected.clear();
    body.querySelectorAll('.v.sel').forEach((v) => v.classList.remove('sel'));
    updateSelBar();
  }
  function selectedText() {
    const nums = sorted();
    const fmt = state.settings.accents ? (t) => t : stripAccents;
    return { text: nums.map((v) => fmt(verses[v - 1])).join(' '), ref: refLabel(id, n, nums) };
  }
  async function refreshMarks() { marks = await chapterMarks(id, n); renderText(); }

  async function applyColor(color) {
    for (const v of sorted()) await updateMark(id, n, v, { color });
    toast(color ? 'Вірші виділено' : 'Виділення знято');
    clearSelection();
    refreshMarks();
  }
  async function toggleBookmark() {
    const nums = sorted();
    const on = !nums.every((v) => marks.get(`${n}:${v}`)?.bookmark);
    await updateMark(id, n, nums[0], { bookmark: on });
    toast(on ? 'Закладку додано' : 'Закладку прибрано');
    clearSelection();
    refreshMarks();
  }
  function editNote() {
    const nums = sorted();
    const v = nums[0];
    const ref = refLabel(id, n, nums);
    const prevNote = marks.get(`${n}:${v}`)?.note || '';
    const area = h('textarea', { class: 'journal-input', rows: 6, placeholder: 'Думка, питання, молитва до цього вірша…' });
    area.value = prevNote;
    const saveBtn = h('button', {
      class: 'btn',
      onclick: async () => {
        const note = area.value.trim();
        await updateMark(id, n, v, { note: note || null, noteRef: ref, noteText: selectedText().text.slice(0, 400) });
        closeSheet();
        toast(note ? 'Нотатку збережено в щоденнику' : 'Нотатку видалено');
        clearSelection();
        refreshMarks();
      },
    }, icon('check'), 'Зберегти');
    openSheet(`Нотатка · ${ref}`, h('div', {},
      h('blockquote', { class: 'note-quote' }, selectedText().text),
      area, h('div', { class: 'deck-nav' }, h('span'), saveBtn)));
    setTimeout(() => area.focus(), 320);
  }
  async function copySelected() {
    const { text, ref } = selectedText();
    toast((await copyText(`${text}\n— ${ref} (пер. І. Огієнка)`)) ? 'Скопійовано' : 'Не вдалося скопіювати');
    clearSelection();
  }
  function shareSelected() {
    const { text, ref } = selectedText();
    openShareCard({ text, ref });
    clearSelection();
  }
  function lectioSelected() {
    const nums = sorted();
    location.hash = `#/lectio/${id}/${n}/${nums[0]}-${nums[nums.length - 1]}`;
  }

  // ── Прокрутка: ховаємо панель під час читання, запам'ятовуємо місце
  let lastY = 0, ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      bar.classList.toggle('scrolled', y > 8);
      if (y > lastY + 6 && y > 90) bar.classList.add('hidden');
      else if (y < lastY - 6) bar.classList.remove('hidden');
      lastY = y;
      state.last = { id, n, y: Math.round(y), at: Date.now() };
      save();
      checkEnd();
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(() => window.removeEventListener('scroll', onScroll));

  // ── Позначка «прочитано», коли дійшли до кінця
  let readTimer = null;
  const endVisible = () => endMark.getBoundingClientRect().top < window.innerHeight;
  function checkEnd() {
    if (isRead(id, n)) return;
    if (!endVisible()) { clearTimeout(readTimer); readTimer = null; return; }
    if (readTimer) return;
    readTimer = setTimeout(() => {
      readTimer = null;
      if (endVisible() && markRead(id, n)) doneNote.hidden = false;
    }, Math.max(0, READ_AFTER_MS - (Date.now() - openedAt)));
  }
  cleanups.push(() => clearTimeout(readTimer));

  // ── Гортання свайпом і стрілками
  let touch = null;
  article.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touch = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
  }, { passive: true });
  article.addEventListener('touchend', (e) => {
    if (!touch) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    const fast = Date.now() - touch.at < 700;
    touch = null;
    if (fast && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) go(dx < 0 ? next : prev, dx < 0 ? 'left' : 'right');
  });
  const onKey = (e) => {
    if (document.querySelector('.sheet') || e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, textarea')) return;
    if (e.key === 'ArrowRight') go(next, 'left');
    else if (e.key === 'ArrowLeft') go(prev, 'right');
    else if (e.key === 'Escape') clearSelection();
  };
  document.addEventListener('keydown', onKey);
  cleanups.push(() => document.removeEventListener('keydown', onKey));

  function go(target, dir) {
    if (!target) return;
    article.classList.remove('view-enter');
    article.classList.add(dir === 'left' ? 'swipe-out-left' : 'swipe-out-right');
    setTimeout(() => { location.hash = `#/read/${target.id}/${target.n}`; }, 150);
  }

  function navLink(t, kind) {
    return h('a', { class: kind, href: `#/read/${t.id}/${t.n}` },
      h('small', {}, kind === 'prev' ? '← Попередній' : 'Наступний →'),
      h('span', {}, t.id === id ? (id === 'PSA' ? `Псалом ${t.n}` : `Розділ ${t.n}`) : chapterTitle(t.id, t.n)));
  }

  function openChapterPicker() {
    const grid = h('ul', { class: 'chapter-grid' }, b.verses.map((_, i) => {
      const k = i + 1;
      const cls = [isRead(id, k) && 'read', k === n && 'current'].filter(Boolean).join(' ');
      return h('li', {}, h('a', { href: `#/read/${id}/${k}`, class: cls || null }, k));
    }));
    openSheet(b.short, h('div', {}, grid,
      h('a', { class: 'row-link', href: '#/bible' }, 'Інша книга', icon('next'))));
  }

  function openTextSheet() {
    openSheet('Текст', textSettingsPanel());
  }

  // Повернення на те саме місце, якщо продовжуємо читання; або до конкретного вірша
  const resumeY = !focusVerse && state.last?.id === id && state.last?.n === n ? state.last.y : 0;
  state.last = { id, n, y: resumeY, at: Date.now() };
  save();

  return {
    el,
    tab: 'bible',
    title,
    immersive: true,
    keepScroll: true,
    mounted() {
      if (focusVerse) {
        const v = body.querySelector(`.v[data-v="${focusVerse}"]`);
        if (v) {
          v.scrollIntoView({ block: 'center' });
          v.classList.add('flash');
          setTimeout(() => v.classList.remove('flash'), 2400);
        }
      } else {
        window.scrollTo(0, resumeY || 0);
      }
      checkEnd();
    },
    destroy() { stopSpeaking(); cleanups.forEach((fn) => fn()); },
  };
}
