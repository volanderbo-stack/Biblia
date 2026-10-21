import { h, hydrateIcons, closeSheet } from './ui.js';
import { state, onSettings } from './store.js';
import { prefetchAll } from './offline.js';
import { checkAchievements } from './progress.js';
import { initReminders } from './reminders.js';
import * as today from './views/today.js';
import * as plans from './views/plans.js';
import * as progressView from './views/progress.js';
import * as bibleHome from './views/bible-home.js';
import * as bookView from './views/book.js';
import * as reader from './views/reader.js';
import * as journal from './views/journal.js';
import * as more from './views/more.js';
import * as lectio from './views/lectio.js';
import * as search from './views/search.js';
import * as marks from './views/marks.js';

const BOOK = '([1-3A-Z]{3})';
const ROUTES = [
  [/^\/(today)?$/, () => today.render()],
  [/^\/plans$/, () => plans.render()],
  [/^\/plan\/([a-z0-9]+)\/([\d-]+)$/, (m) => plans.renderDay({ id: m[1], key: m[2] })],
  [/^\/progress$/, () => progressView.render()],
  [/^\/bible$/, () => bibleHome.render()],
  [new RegExp(`^/bible/${BOOK}$`), (m) => bookView.render({ id: m[1] })],
  [new RegExp(`^/read/${BOOK}/(\\d+)(?:/(\\d+))?$`), (m) => reader.render({ id: m[1], n: +m[2], verse: m[3] ? +m[3] : null })],
  [/^\/lectio$/, () => lectio.renderHome()],
  [new RegExp(`^/lectio/${BOOK}/(\\d+)/(\\d+)-(\\d+)$`), (m) => lectio.renderSession({ id: m[1], c: +m[2], a: +m[3], b: +m[4] })],
  [/^\/search$/, () => search.render()],
  [/^\/marks$/, () => marks.render()],
  [/^\/journal$/, () => journal.render()],
  [/^\/more$/, () => more.render()],
];

const viewRoot = document.getElementById('view');
const tabs = [...document.querySelectorAll('#tabbar .tab')];
let current = null;
let routeToken = 0;

async function route() {
  const path = location.hash.slice(1) || '/today';
  const match = ROUTES.find(([re]) => re.test(path));
  if (!match) { location.replace('#/today'); return; }
  closeSheet();

  const token = ++routeToken;
  let view;
  try {
    view = await match[1](path.match(match[0]));
  } catch (err) {
    console.error(err);
    view = errorView();
  }
  if (token !== routeToken || !view) return;

  current?.destroy?.();
  current = view;
  viewRoot.replaceChildren(view.el);
  document.body.classList.toggle('immersive', !!view.immersive);
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === view.tab));
  document.title = view.title ? `${view.title} · Слово на кожен день` : 'Слово на кожен день';
  if (!view.keepScroll) window.scrollTo(0, 0);
  view.mounted?.();
}

function errorView() {
  return {
    el: h('div', { class: 'card soon', style: { marginTop: '40px' } },
      h('h2', {}, 'Не вдалося відкрити'),
      h('p', {}, 'Можливо, цей текст ще не збережено на пристрої, а інтернету немає.'),
      h('p', {}, h('button', { class: 'btn', style: { marginTop: '14px' }, onclick: route }, 'Спробувати ще'))),
    tab: null,
  };
}

// ── Тема й розмір тексту
const darkMq = matchMedia('(prefers-color-scheme: dark)');
const themeMeta = document.querySelector('meta[name="theme-color"]');
function applySettings(s = state.settings) {
  const dark = s.theme === 'dark' || (s.theme === 'auto' && darkMq.matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.setProperty('--reader-size', `${s.fontSize}px`);
  root.style.setProperty('--reader-lh', String(s.lineHeight));
  themeMeta.content = dark ? '#15120E' : '#F6F1E7';
}
applySettings();
onSettings(applySettings);
darkMq.addEventListener('change', () => applySettings());

hydrateIcons();
window.addEventListener('hashchange', route);
window.addEventListener('app:rerender', route);
route();

// ── Офлайн, нагадування, досягнення
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2500));
  if (!navigator.connection?.saveData) {
    idle(() => prefetchAll('uk').catch((e) => console.warn('prefetch', e)));
  }
}
initReminders();
setTimeout(() => checkAchievements({ silent: true }), 1500);
