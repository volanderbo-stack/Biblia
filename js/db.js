// IndexedDB: щоденник і позначки віршів (з запасним варіантом у localStorage, якщо IndexedDB недоступна)
const DB_NAME = 'slovo';
const VERSION = 2;

let dbPromise = null;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no-idb')); return; }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('journal')) {
        db.createObjectStore('journal', { keyPath: 'id' }).createIndex('updated', 'updated');
      }
      if (!db.objectStoreNames.contains('verses')) {
        // id: 'MRK.1.5'; chapter: 'MRK.1' — щоб швидко брати позначки розділу
        db.createObjectStore('verses', { keyPath: 'id' }).createIndex('chapter', 'chapter');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function request(storeName, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  }));
}

function store(name) {
  const key = `slovo:${name}`;
  const fbRead = () => { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } };
  const fbWrite = (all) => { try { localStorage.setItem(key, JSON.stringify(all)); } catch { /* немає місця */ } };
  const safe = async (idb, fb) => { try { return await idb(); } catch { return fb(); } };
  return {
    get: (id) => safe(() => request(name, 'readonly', (s) => s.get(id)), () => fbRead()[id]),
    put: (entry) => safe(() => request(name, 'readwrite', (s) => s.put(entry)), () => { const a = fbRead(); a[entry.id] = entry; fbWrite(a); }),
    delete: (id) => safe(() => request(name, 'readwrite', (s) => s.delete(id)), () => { const a = fbRead(); delete a[id]; fbWrite(a); }),
    all: () => safe(() => request(name, 'readonly', (s) => s.getAll()), () => Object.values(fbRead())),
    byIndex: (index, value) => safe(
      () => request(name, 'readonly', (s) => s.index(index).getAll(value)),
      () => Object.values(fbRead()).filter((e) => e[index] === value)),
  };
}

export const journal = store('journal');
export const verseMarks = store('verses');

// Позначки віршів розділу як Map('c:v' → запис)
export async function chapterMarks(id, c) {
  const list = await verseMarks.byIndex('chapter', `${id}.${c}`).catch(() => []);
  return new Map(list.map((m) => [`${m.c}:${m.v}`, m]));
}

// Оновити позначку вірша; порожній запис видаляється
export async function updateMark(id, c, v, patch) {
  const key = `${id}.${c}.${v}`;
  const prev = (await verseMarks.get(key)) || { id: key, book: id, chapter: `${id}.${c}`, c, v, created: Date.now() };
  const next = { ...prev, ...patch, updated: Date.now() };
  if (!next.color && !next.bookmark && !next.note) { await verseMarks.delete(key); return null; }
  await verseMarks.put(next);
  return next;
}
