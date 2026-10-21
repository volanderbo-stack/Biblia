import { loadBooks } from './bible.js';

// Та сама назва кешу, що й у sw.js
export const DATA_CACHE = 'slovo-data-v1';

const urlsFor = async (lang) => (await loadBooks()).map((b) => `data/${lang}/${b.id}.json`);

export async function offlineStatus(lang = 'uk') {
  if (!('caches' in window)) throw new Error('no-cache-api');
  const urls = await urlsFor(lang);
  const cache = await caches.open(DATA_CACHE);
  const hits = await Promise.all(urls.map((u) => cache.match(u)));
  return { done: hits.filter(Boolean).length, total: urls.length };
}

const running = {};
// Завантажує всі книги в кеш, щоб читати без інтернету. Прогрес — подія 'offline-progress'.
export function prefetchAll(lang = 'uk', onProgress) {
  running[lang] ??= (async () => {
    if (!('caches' in window)) return;
    const urls = await urlsFor(lang);
    const cache = await caches.open(DATA_CACHE);
    let done = 0;
    for (const url of urls) {
      if (!(await cache.match(url))) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(url);
        await cache.put(url, res);
      }
      done++;
      onProgress?.(done, urls.length);
      window.dispatchEvent(new CustomEvent('offline-progress', { detail: { lang, done, total: urls.length } }));
    }
  })().finally(() => { delete running[lang]; });
  return running[lang];
}
