// Доступ до тексту Біблії: метадані книг, розділи, сусідні розділи, посилання.
let booksPromise = null;
let list = [];
const byId = new Map();
const bookCache = new Map(); // `${lang}/${id}` -> Promise<string[][]>

export const GROUPS = {
  law: 'Пʼятикнижжя Мойсеєве',
  history: 'Історичні книги',
  wisdom: 'Учительні книги',
  prophets: 'Великі пророки',
  minor: 'Малі пророки',
  gospels: 'Євангелія',
  acts: 'Історична книга',
  catholic: 'Соборні послання',
  paul: 'Послання апостола Павла',
  revelation: 'Пророча книга',
};

// Книги, де кожен вірш краще показувати окремим рядком
export const POETIC = new Set(['PSA', 'PRO', 'JOB', 'SNG', 'LAM']);

export function loadBooks() {
  booksPromise ??= fetch('data/books.json')
    .then((r) => { if (!r.ok) throw new Error('books.json'); return r.json(); })
    .then((data) => {
      list = data;
      data.forEach((b, i) => { b.index = i; byId.set(b.id, b); });
      return data;
    })
    .catch((e) => { booksPromise = null; throw e; });
  return booksPromise;
}

export const books = () => list;
export const book = (id) => byId.get(id);

export function loadBook(id, lang = 'uk') {
  const key = `${lang}/${id}`;
  if (!bookCache.has(key)) {
    const p = fetch(`data/${lang}/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(key);
      return r.json();
    });
    p.catch(() => bookCache.delete(key));
    bookCache.set(key, p);
    if (bookCache.size > 12) bookCache.delete(bookCache.keys().next().value);
  }
  return bookCache.get(key);
}

export async function chapter(id, n, lang = 'uk') {
  const data = await loadBook(id, lang);
  return data[n - 1] || [];
}

export async function verse(id, n, v, lang = 'uk') {
  return (await chapter(id, n, lang))[v - 1] || '';
}

// Наступний / попередній розділ з переходом між книгами
export function neighbor(id, n, dir) {
  const b = book(id);
  if (!b) return null;
  const m = n + dir;
  if (m >= 1 && m <= b.verses.length) return { id, n: m };
  const nb = list[b.index + dir];
  if (!nb) return null;
  return { id: nb.id, n: dir > 0 ? 1 : nb.verses.length };
}

// Псалми подано за єврейською нумерацією (як у більшості видань Огієнка);
// у церковному вжитку поширена грецька, її показуємо в дужках.
export function psalmGreek(n) {
  if (n <= 8 || n >= 148) return null;
  if (n === 9 || n === 10) return '9';
  if (n <= 113) return String(n - 1);
  if (n === 114 || n === 115) return '113';
  if (n === 116) return '114–115';
  if (n <= 146) return String(n - 1);
  return '146–147';
}

export function chapterTitle(id, n) {
  const b = book(id);
  if (id === 'PSA') return `Псалом ${n}`;
  return `${b ? b.short : id} ${n}`;
}

export function refLabel(id, n, verses = []) {
  const b = book(id);
  const base = `${b ? b.abbr : id} ${n}`;
  if (!verses.length) return base;
  return `${base}:${compressRanges(verses)}`;
}

function compressRanges(nums) {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j > i ? `${s[i]}–${s[j]}` : `${s[i]}`);
    i = j;
  }
  return out.join(', ');
}

export const stripAccents = (s) => s.replace(/́/g, '');

// Діапазон «1:21-1:45» або «2:18-3:6»
export function parseRange(s) {
  const [a, b = a] = s.split('-');
  const [c1, v1] = a.split(':').map(Number);
  const [c2, v2] = b.split(':').map(Number);
  return { c1, v1, c2, v2 };
}

// Вірші діапазону: [{ c, v, t }]
export async function passage(id, range, lang = 'uk') {
  const { c1, v1, c2, v2 } = parseRange(range);
  const data = await loadBook(id, lang);
  const out = [];
  for (let c = c1; c <= c2; c++) {
    const chap = data[c - 1] || [];
    const lo = c === c1 ? v1 : 1;
    const hi = c === c2 ? Math.min(v2, chap.length) : chap.length;
    for (let v = lo; v <= hi; v++) out.push({ c, v, t: chap[v - 1] });
  }
  return out;
}

function isWholeChapter(id, { c1, v1, c2, v2 }) {
  const b = book(id);
  return c1 === c2 && v1 === 1 && b && v2 >= b.verses[c1 - 1];
}

// Коротке посилання: «Мк 2:18 – 3:6», «Мк 1:1–20», «Пс 23»
export function rangeLabel(id, range) {
  const r = parseRange(range);
  const b = book(id);
  const abbr = b ? b.abbr : id;
  if (isWholeChapter(id, r)) return `${abbr} ${r.c1}`;
  if (r.c1 === r.c2) return r.v1 === r.v2 ? `${abbr} ${r.c1}:${r.v1}` : `${abbr} ${r.c1}:${r.v1}–${r.v2}`;
  return `${abbr} ${r.c1}:${r.v1} – ${r.c2}:${r.v2}`;
}

// Заголовок уривка: «Від Марка 1:1–20», «Псалом 63, вірші 2–9»
export function rangeTitle(id, range) {
  const r = parseRange(range);
  if (id === 'PSA') {
    const whole = isWholeChapter(id, r);
    return whole ? `Псалом ${r.c1}` : `Псалом ${r.c1}, вірші ${r.v1}–${r.v2}`;
  }
  return rangeLabel(id, range).replace(book(id)?.abbr ?? id, book(id)?.short ?? id);
}
