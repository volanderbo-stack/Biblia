// Service worker: оболонка застосунку — спочатку мережа (з таймаутом), текст Біблії — спочатку кеш.
const SHELL_CACHE = 'slovo-shell-v4';
const DATA_CACHE = 'slovo-data-v1';
const META_CACHE = 'slovo-meta';

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/ui.js',
  'js/icons.js',
  'js/store.js',
  'js/bible.js',
  'js/books-info.js',
  'js/offline.js',
  'js/db.js',
  'js/text.js',
  'js/tts.js',
  'js/sharecard.js',
  'js/progress.js',
  'js/reminders.js',
  'js/lectionary.js',
  'js/plans/index.js',
  'js/plans/mark30.js',
  'js/plans/life40.js',
  'js/plans/generic.js',
  'js/views/daily.js',
  'js/views/today.js',
  'js/views/plans.js',
  'js/views/progress.js',
  'js/views/bible-home.js',
  'js/views/book.js',
  'js/views/reader.js',
  'js/views/text-settings.js',
  'js/views/journal.js',
  'js/views/more.js',
  'js/views/lectio.js',
  'js/views/search.js',
  'js/views/marks.js',
  'data/books.json',
  'data/lectionary.json',
  'data/plans/year.json',
  'data/plans/psalms-proverbs.json',
  'fonts/literata-cyrillic-normal.woff2',
  'fonts/literata-cyrillic-italic.woff2',
  'fonts/literata-latin-normal.woff2',
  'fonts/literata-latin-italic.woff2',
  'fonts/literata-latin-ext-normal.woff2',
  'fonts/literata-latin-ext-italic.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, DATA_CACHE, META_CACHE]);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const scope = new URL(self.registration.scope);
  const rel = url.pathname.slice(scope.pathname.length);
  if (/^data\/(uk|fr)\//.test(rel)) {
    e.respondWith(cacheFirst(req, rel));
  } else {
    e.respondWith(networkFirst(req));
  }
});

async function cacheFirst(req, key) {
  const cache = await caches.open(DATA_CACHE);
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(key, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await Promise.race([
      fetch(req, { cache: 'no-cache' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3500)),
    ]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  }
}

// ── Нагадування у фоні (periodic background sync, де підтримується)
const localKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

self.addEventListener('periodicsync', (e) => {
  if (e.tag !== 'slovo-reminder') return;
  e.waitUntil((async () => {
    const res = await (await caches.open(META_CACHE)).match('reminder.json');
    if (!res) return;
    const r = await res.json();
    if (!r.enabled || r.lastActive === localKey()) return;
    const [hh, mm] = r.time.split(':').map(Number);
    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() < hh * 60 + mm) return;
    const shown = await self.registration.getNotifications({ tag: 'slovo-reminder' });
    if (shown.length) return;
    await self.registration.showNotification('Слово на кожен день', {
      body: 'Знайди 10 хвилин для сьогоднішнього читання.', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'slovo-reminder',
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = all.find((c) => c.url.startsWith(self.registration.scope));
    if (client) { await client.focus(); client.navigate?.(`${self.registration.scope}#/today`); }
    else await self.clients.openWindow('./#/today');
  })());
});
