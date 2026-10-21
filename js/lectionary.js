// Церковні читання дня (Апостол і Євангеліє) за візантійським лекціонарієм слов'янської традиції.
// Алгоритм перенесено з orthocal-python (MIT, © Brian Glass): calendarium/liturgics/{year,day}.py.
// Календар: 'new' — новоюліанський (ПЦУ та УГКЦ з 1.09.2023), 'old' — юліанський (старий стиль).
// Пасха в обох випадках обчислюється однаково (православна пасхалія).

let dataPromise = null;
let DATA = null;

export function loadLectionary() {
  dataPromise ??= fetch('data/lectionary.json').then((r) => r.json()).then((d) => {
    const byPdist = new Map(), byFixed = new Map(), dayPdist = new Map(), dayFixed = new Map();
    d.r.forEach(([pdist, month, day, src, desc, peri, ordering]) => {
      const row = { pdist, month, day, src, desc, peri: d.peri[peri], ordering };
      const map = pdist == null ? byFixed : byPdist;
      const key = pdist == null ? `${month}/${day}` : pdist;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    d.d.forEach(([pdist, month, day, level, fastEx]) => {
      const map = pdist == null ? dayFixed : dayPdist;
      const key = pdist == null ? `${month}/${day}` : pdist;
      const prev = map.get(key);
      map.set(key, { level: Math.max(level, prev?.level ?? -9), fastEx: Math.max(fastEx, prev?.fastEx ?? 0) });
    });
    DATA = { byPdist, byFixed, dayPdist, dayFixed };
    return DATA;
  }).catch((e) => { dataPromise = null; throw e; });
  return dataPromise;
}

// ── Дати
const fdiv = (a, b) => Math.floor(a / b);
const mod = (a, b) => ((a % b) + b) % b;

export function gregorianToJdn(y, m, d) {
  const a = fdiv(14 - m, 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + fdiv(153 * mm + 2, 5) + 365 * yy + fdiv(yy, 4) - fdiv(yy, 100) + fdiv(yy, 400) - 32045;
}
export function julianToJdn(y, m, d) {
  const a = fdiv(14 - m, 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + fdiv(153 * mm + 2, 5) + 365 * yy + fdiv(yy, 4) - 32083;
}
export function jdnToJulian(jdn) {
  const c = jdn + 32082, d = fdiv(4 * c + 3, 1461), e = c - fdiv(1461 * d, 4), m = fdiv(5 * e + 2, 153);
  return { y: d - 4800 + fdiv(m, 10), m: m + 3 - 12 * fdiv(m, 10), d: e - fdiv(153 * m + 2, 5) + 1 };
}
export function jdnToGregorian(jdn) {
  const a = jdn + 32044, b = fdiv(4 * a + 3, 146097), c = a - fdiv(146097 * b, 4);
  const d = fdiv(4 * c + 3, 1461), e = c - fdiv(1461 * d, 4), m = fdiv(5 * e + 2, 153);
  return { y: 100 * b + d - 4800 + fdiv(m, 10), m: m + 3 - 12 * fdiv(m, 10), d: e - fdiv(153 * m + 2, 5) + 1 };
}

// Православна Пасха (юліанська пасхалія) як юліанський номер дня
export function paschaJdn(y) {
  const a = y % 4, b = y % 7, c = y % 19;
  const d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const month = fdiv(d + e + 114, 31), day = ((d + e + 114) % 31) + 1;
  return julianToJdn(y, month, day);
}

const wd = (p) => mod(p, 7); // 0 — неділя (Пасха завжди в неділю)

function surrounding(p) {
  const w = wd(p);
  return [p - w - 1, p - 7 + mod(7 - w, 7), p + 7 - mod(w + 1, 7), p + 7 - w];
}

const F = {
  FathersSix: 1001, FathersSeventh: 1002, DemetriusSaturday: 1003, SynaxisUnmercenaries: 1004,
  SatBeforeElevationMoved: 1005, SatBeforeElevation: 1006, SunBeforeElevation: 1007, SatAfterElevation: 1008,
  SunAfterElevation: 1009, SunForefathers: 1010, SatBeforeNativity: 1011, SunBeforeNativity: 1012,
  RoyalHoursNativityFriday: 1013, EveNativity: 1014, SatBeforeNativityEve: 1015, SunBeforeNativityEve: 1016,
  SatAfterNativityBeforeTheophany: 1017, SatAfterNativityFriday: 1018, SatAfterNativity: 1019,
  SunAfterNativityMonday: 1020, SunAfterNativitiy: 1021, SatBeforeTheophany: 1022, SatBeforeTheophanyJan: 1023,
  SunBeforeTheophany: 1024, RoyalHoursTheophanyFriday: 1025, TheophanyEve: 1026, SatBeforeTheophanyEve: 1027,
  SunBeforeTheophanyEve: 1028, SatAfterTheophany: 1029, SunAfterTheophany: 1030,
  AnnunciationParemFriday: 1032, AnnunciationSat: 1033, AnnunciationSun: 1034, AnnunciationMon: 1035,
  AnnunciationParemEve: 1036, AnnunciationWeekday: 1037, LeavetakingTheophanyWeekday: 1038,
};

// ── Літургійний рік (від неділі Закхея до наступної), слов'янська традиція
const yearCache = new Map();
function slavicYear(year, julian) {
  const key = `${year}:${julian}`;
  if (yearCache.has(key)) return yearCache.get(key);
  const pascha = paschaJdn(year);
  const nextPascha = paschaJdn(year + 1);
  const d2p = (m, d, y) => (julian ? julianToJdn(y, m, d) : gregorianToJdn(y, m, d)) - pascha;

  const Y = { year, pascha, nextPascha };
  Y.elevation = d2p(9, 14, year);
  Y.theophany = d2p(1, 6, year + 1);
  Y.nativity = d2p(12, 25, year);
  Y.annunciation = d2p(3, 25, year);
  Y.nativityTheotokos = d2p(9, 8, year);
  [Y.satBeforeElevation, Y.sunBeforeElevation, Y.satAfterElevation, Y.sunAfterElevation] = surrounding(Y.elevation);
  [Y.satBeforeTheophany, Y.sunBeforeTheophany, Y.satAfterTheophany, Y.sunAfterTheophany] = surrounding(Y.theophany);
  [Y.satBeforeNativity, Y.sunBeforeNativity, Y.satAfterNativity, Y.sunAfterNativity] = surrounding(Y.nativity);

  Y.forefathers = Y.nativity - 14 + mod(7 - wd(Y.nativity), 7);
  Y.lukanJump = (49 + 1 + 7 * 17) - (Y.sunAfterElevation + 1);
  Y.lukanJumpThreshold = Y.sunAfterElevation;
  Y.firstSunLuke = Y.sunAfterElevation + 7;
  Y.extraSundays = fdiv((nextPascha - 12 * 7) - (pascha + Y.sunAfterTheophany), 7);

  Y.noDaily = new Set([Y.sunBeforeTheophany, Y.sunAfterTheophany, Y.theophany - 5, Y.theophany - 1, Y.theophany,
    Y.forefathers, Y.sunBeforeNativity, Y.nativity - 1, Y.nativity, Y.nativity + 1, Y.sunAfterNativity]);
  if (Y.satAfterTheophany === Y.theophany + 1) Y.noDaily.add(Y.satAfterTheophany);
  if (wd(Y.annunciation) === 6) Y.noDaily.add(Y.annunciation);

  // Невичитані недільні Євангелія, які читаються між Богоявленням і Тріоддю
  Y.reserves = [];
  const firstLuke = 49 + 7 * 18;
  const thirteenthLuke = firstLuke + 7 * 13;
  if (Y.extraSundays) {
    for (let p = Y.forefathers + Y.lukanJump + 7; p <= thirteenthLuke; p += 7) Y.reserves.push(p);
    const remainder = Y.extraSundays - Y.reserves.length;
    if (remainder) {
      for (let p = firstLuke - remainder * 7; p < firstLuke - 6; p += 7) Y.reserves.push(p);
    }
  }

  // Плаваючі свята
  const fl = new Map();
  const six = d2p(7, 16, year);
  fl.set(wd(six) < 4 ? six - wd(six) : six + 7 - wd(six), F.FathersSix);
  let seven = d2p(10, 11, year);
  if (wd(seven) > 0) seven += 7 - wd(seven);
  fl.set(seven, F.FathersSeventh);
  const dem = d2p(10, 26, year);
  fl.set(dem - wd(dem) - 1, F.DemetriusSaturday);
  const unm = d2p(11, 1, year);
  fl.set(unm + 7 - wd(unm), F.SynaxisUnmercenaries);
  fl.set(Y.sunBeforeElevation, F.SunBeforeElevation);
  fl.set(Y.satAfterElevation, F.SatAfterElevation);
  fl.set(Y.sunAfterElevation, F.SunAfterElevation);
  fl.set(Y.forefathers, F.SunForefathers);
  fl.set(Y.satAfterTheophany, F.SatAfterTheophany);
  fl.set(Y.sunAfterTheophany, F.SunAfterTheophany);
  const leave = Y.theophany + 8;
  if (wd(leave) !== 6 && wd(leave) !== 0) fl.set(leave, F.LeavetakingTheophanyWeekday);
  if (Y.satBeforeElevation === Y.nativityTheotokos) fl.set(Y.elevation - 1, F.SatBeforeElevationMoved);
  else fl.set(Y.satBeforeElevation, F.SatBeforeElevation);

  const eve = Y.nativity - 1;
  if (eve === Y.satBeforeNativity) {
    fl.set(Y.nativity - 2, F.RoyalHoursNativityFriday);
    fl.set(Y.sunBeforeNativity, F.SunBeforeNativity);
    fl.set(eve, F.SatBeforeNativityEve);
  } else if (eve === Y.sunBeforeNativity) {
    fl.set(Y.nativity - 3, F.RoyalHoursNativityFriday);
    fl.set(Y.satBeforeNativity, F.SatBeforeNativity);
    fl.set(eve, F.SunBeforeNativityEve);
  } else {
    fl.set(eve, F.EveNativity);
    fl.set(Y.satBeforeNativity, F.SatBeforeNativity);
    fl.set(Y.sunBeforeNativity, F.SunBeforeNativity);
  }

  const T = Y.theophany;
  switch (wd(Y.nativity)) {
    case 0:
      fl.set(Y.satAfterNativity, F.SatAfterNativityBeforeTheophany);
      fl.set(Y.nativity + 1, F.SunAfterNativityMonday);
      fl.set(Y.sunBeforeTheophany, F.SunBeforeTheophany);
      fl.set(T - 1, F.TheophanyEve);
      break;
    case 1:
      fl.set(Y.satAfterNativity, F.SatAfterNativityBeforeTheophany);
      fl.set(Y.sunAfterNativity, F.SunAfterNativitiy);
      fl.set(T - 5, F.SatBeforeTheophanyJan);
      fl.set(T - 1, F.TheophanyEve);
      break;
    case 2:
      fl.set(Y.satAfterNativity, F.SatAfterNativity);
      fl.set(Y.sunAfterNativity, F.SunAfterNativitiy);
      fl.set(Y.satBeforeTheophany, F.SatBeforeTheophanyEve);
      fl.set(T - 5, F.SatBeforeTheophanyJan);
      fl.set(T - 2, F.RoyalHoursTheophanyFriday);
      break;
    case 3:
      fl.set(Y.satAfterNativity, F.SatAfterNativity);
      fl.set(Y.sunAfterNativity, F.SunAfterNativitiy);
      fl.set(Y.satBeforeTheophany, F.SatBeforeTheophany);
      fl.set(Y.sunBeforeTheophany, F.SunBeforeTheophanyEve);
      fl.set(T - 3, F.RoyalHoursTheophanyFriday);
      break;
    case 4: case 5:
      fl.set(Y.satAfterNativity, F.SatAfterNativity);
      fl.set(Y.sunAfterNativity, F.SunAfterNativitiy);
      fl.set(Y.satBeforeTheophany, F.SatBeforeTheophany);
      fl.set(Y.sunBeforeTheophany, F.SunBeforeTheophany);
      fl.set(T - 1, F.TheophanyEve);
      break;
    case 6:
      fl.set(Y.nativity + 6, F.SatAfterNativityFriday);
      fl.set(Y.sunAfterNativity, F.SunAfterNativitiy);
      fl.set(Y.satBeforeTheophany, F.SatBeforeTheophany);
      fl.set(Y.sunBeforeTheophany, F.SunBeforeTheophany);
      fl.set(T - 1, F.TheophanyEve);
      break;
  }

  const A = Y.annunciation;
  switch (wd(A)) {
    case 6: fl.set(A - 1, F.AnnunciationParemFriday); fl.set(A, F.AnnunciationSat); break;
    case 0: fl.set(A, F.AnnunciationSun); break;
    case 1: fl.set(A, F.AnnunciationMon); break;
    default: fl.set(A - 1, F.AnnunciationParemEve); fl.set(A, F.AnnunciationWeekday);
  }
  Y.floats = fl;

  yearCache.set(key, Y);
  return Y;
}

// ── День
function liturgicalDay(gy, gm, gd, julian) {
  const jdn = gregorianToJdn(gy, gm, gd);
  const dt = julian ? jdnToJulian(jdn) : { y: gy, m: gm, d: gd };
  let pyear = dt.y;
  let pdist = jdn - paschaJdn(pyear);
  if (pdist < -77) { pyear -= 1; pdist = jdn - paschaJdn(pyear); }
  return { jdn, month: dt.m, day: dt.d, pdist, weekday: wd(pdist), Y: slavicYear(pyear, julian) };
}

function epistlePdist(D) {
  const { Y, pdist, jdn } = D;
  if (Y.noDaily.has(pdist)) return null;
  if (pdist === 49 + 29 * 7) return Y.forefathers;
  if (pdist >= 49 + 32 * 7) return jdn - Y.nextPascha;
  return pdist;
}

function gospelPdist(D) {
  const { Y, pdist, jdn, weekday } = D;
  if (Y.noDaily.has(pdist)) return null;
  if (pdist === Y.firstSunLuke + 10 * 7) return Y.forefathers + Y.lukanJump;
  if (weekday === 0 && pdist > Y.sunAfterTheophany && Y.extraSundays > 1) {
    const i = fdiv(pdist - Y.sunAfterTheophany, 7);
    if (i - 1 >= 0 && i - 1 < Y.reserves.length) return Y.reserves[i - 1];
  }
  if (pdist > Y.satBeforeTheophany) return jdn - Y.nextPascha;
  if (pdist > Y.lukanJumpThreshold) return pdist + Y.lukanJump;
  return pdist;
}

function firstPair(rows) {
  const ei = rows.findIndex((r) => r.src === 'E');
  if (ei < 0 || !rows.some((r) => r.src === 'G')) return null;
  const gi = rows.findIndex((r, i) => i > ei && r.src === 'G');
  return [rows[ei], rows[gi >= 0 ? gi : rows.findIndex((r) => r.src === 'G')]];
}

/**
 * Читання на цивільну (григоріанську) дату.
 * @returns {{ pdist, weekday, month, day, feastLevel, title, main: Row[], extra: Row[], lenten: Row[] }}
 */
export async function readingsFor(date, calendar = 'new') {
  const { byPdist, byFixed, dayPdist, dayFixed } = DATA || await loadLectionary();
  const julian = calendar === 'old';
  const D = liturgicalDay(date.getFullYear(), date.getMonth() + 1, date.getDate(), julian);
  const { Y, pdist, month, day, weekday } = D;
  const fixedKey = `${month}/${day}`;
  const floatIdx = Y.floats.get(pdist);

  const dayRows = [dayPdist.get(pdist), dayFixed.get(fixedKey), floatIdx && dayPdist.get(floatIdx)].filter(Boolean);
  const feastLevel = Math.max(0, ...dayRows.map((d) => d.level));
  // Чистий і Страсний тижні: святкові читання не накладаються
  const noOverrides = (pdist >= -48 && pdist <= -44) || (pdist >= -6 && pdist <= -1);
  const noMemorial = [-36, -29, -22].includes(pdist) && month === 3 && [9, 24, 25, 26].includes(day);

  const gp = gospelPdist(D), ep = epistlePdist(D);
  const pick = (rows, src) => (rows || []).filter((r) => r.src === src && !(noMemorial && r.desc === 'Departed'));
  let rows = [];
  if (gp != null) rows.push(...pick(byPdist.get(gp), 'G'));
  if (ep != null) rows.push(...pick(byPdist.get(ep), 'E'));
  const lenten = (byPdist.get(pdist) || []).filter((r) => r.src === 'H' || r.src === 'V');

  let fixed = (byFixed.get(fixedKey) || []).filter((r) => r.src === 'E' || r.src === 'G');
  if (month === 3 && day === 26 && [1, 2, 4].includes(weekday)) fixed = fixed.filter((r) => r.desc !== 'Theotokos');
  const floats = floatIdx ? (byPdist.get(floatIdx) || []).filter((r) => r.src === 'E' || r.src === 'G') : [];

  const all = [...rows, ...(feastLevel >= 2 && !noOverrides ? fixed : []), ...floats].sort((a, b) => a.ordering - b.ordering);
  const fl = all.filter((r) => r.pdist != null && r.pdist >= 1000);
  const propers = all.filter((r) => r.month && !fl.includes(r));
  const ordinary = all.filter((r) => !fl.includes(r) && !r.month);
  const preferPropers = feastLevel >= 3 && weekday !== 0;
  const groups = [fl, ...(preferPropers ? [propers, ordinary] : [ordinary, propers])];
  let main = null;
  for (const g of groups) { main = firstPair(g); if (main) break; }
  main ??= firstPair(all) || [];

  // Усі інші Апостоли/Євангелія дня (свята святих, за упокій тощо)
  const extraPool = [...all, ...(noOverrides ? [] : fixed.filter((r) => !all.includes(r)))];
  const extra = extraPool.filter((r, i) => !main.includes(r) && extraPool.indexOf(r) === i);

  return {
    pdist, weekday, month, day, feastLevel, calendar,
    title: dayTitle(D, floatIdx),
    feast: feastName(month, day, pdist),
    main, extra, lenten: main.length ? [] : lenten,
  };
}

// ── Назви днів українською
const WEEKDAYS = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', "Пʼятниця", 'Субота'];
// Порядковий числівник жіночого роду: 1-ша, 2-га, 3-тя, 7-ма, 11-та, 21-ша
function ordinal(n) {
  const t = n % 100, u = n % 10;
  if (t >= 11 && t <= 19) return `${n}-та`;
  return `${n}-${{ 1: 'ша', 2: 'га', 3: 'тя', 7: 'ма', 8: 'ма' }[u] || 'та'}`;
}
const ordWeek = (n) => `${n}-го`;

const PASCHAL = {
  [-77]: 'Неділя про Закхея', [-70]: 'Неділя про митаря і фарисея', [-63]: 'Неділя про блудного сина',
  [-57]: 'Вселенська поминальна субота', [-56]: "Неділя мʼясопусна, про Страшний суд",
  [-49]: 'Неділя сиропусна, Прощена неділя', [-48]: 'Чистий понеділок — початок Великого посту',
  [-42]: "Неділя 1-ша Великого посту, Торжество Православʼя", [-35]: 'Неділя 2-га Великого посту, свт. Григорія Палами',
  [-28]: 'Неділя 3-тя Великого посту, Хрестопоклонна', [-21]: 'Неділя 4-та Великого посту, прп. Івана Ліствичника',
  [-14]: 'Неділя 5-та Великого посту, прп. Марії Єгипетської', [-8]: 'Лазарева субота',
  [-7]: 'Вхід Господній у Єрусалим (Квітна неділя)', [-6]: 'Великий понеділок', [-5]: 'Великий вівторок',
  [-4]: 'Велика середа', [-3]: 'Великий четвер', [-2]: "Велика пʼятниця", [-1]: 'Велика субота',
  0: 'Світле Христове Воскресіння. Пасха', 7: 'Неділя 2-га після Пасхи, апостола Томи',
  14: 'Неділя 3-тя після Пасхи, святих жінок-мироносиць', 21: 'Неділя 4-та після Пасхи, про розслабленого',
  24: 'Преполовення Пʼятдесятниці', 28: 'Неділя 5-та після Пасхи, про самарянку',
  35: 'Неділя 6-та після Пасхи, про сліпого', 38: 'Віддання Пасхи', 39: 'Вознесіння Господнє',
  42: 'Неділя 7-ма після Пасхи, святих отців I Вселенського собору', 48: 'Троїцька поминальна субота',
  49: "Пʼятдесятниця. Свята Трійця", 50: 'День Святого Духа', 56: 'Неділя 1-ша після Пʼятдесятниці, Всіх святих',
};

const FIXED = {
  '1/1': 'Обрізання Господнє. Свт. Василія Великого', '1/5': "Навечірʼя Богоявлення", '1/6': 'Богоявлення. Хрещення Господнє',
  '1/7': 'Собор Івана Хрестителя', '1/17': 'Прп. Антонія Великого', '1/30': 'Собор трьох святителів',
  '2/2': 'Стрітення Господнє', '2/24': 'Перше і друге знайдення глави Івана Хрестителя', '3/9': 'Сорок мучеників Севастійських',
  '3/25': 'Благовіщення Пресвятої Богородиці', '4/23': 'Вмч. Юрія Переможця', '4/25': 'Ап. і євангеліста Марка',
  '5/8': 'Ап. і євангеліста Івана Богослова', '5/11': 'Рівноапп. Кирила і Мефодія', '6/24': 'Різдво Івана Хрестителя',
  '6/29': 'Первоверховних апп. Петра і Павла', '6/30': 'Собор 12 апостолів', '7/15': 'Рівноап. князя Володимира',
  '7/20': 'Пророка Іллі', '8/6': 'Преображення Господнє', '8/15': 'Успіння Пресвятої Богородиці',
  '8/16': 'Перенесення Нерукотворного Образу', '8/29': 'Усікновення глави Івана Хрестителя',
  '9/8': 'Різдво Пресвятої Богородиці', '9/14': 'Воздвиження Чесного Хреста', '9/26': 'Преставлення ап. Івана Богослова',
  '10/1': 'Покров Пресвятої Богородиці', '10/18': 'Ап. і євангеліста Луки', '10/26': 'Вмч. Димитрія Солунського',
  '11/8': 'Собор архістратига Михаїла', '11/13': 'Свт. Івана Золотоустого', '11/14': 'Ап. Филипа',
  '11/16': 'Ап. і євангеліста Матвія', '11/21': 'Введення в храм Пресвятої Богородиці', '11/30': 'Ап. Андрія Первозванного',
  '12/6': 'Свт. Миколая Чудотворця', '12/9': 'Зачаття праведною Анною Пресвятої Богородиці', '12/24': "Святвечір. Навечірʼя Різдва",
  '12/25': 'Різдво Христове', '12/26': 'Собор Пресвятої Богородиці', '12/27': 'Ап. першомученика Стефана',
};

function feastName(month, day) { return FIXED[`${month}/${day}`] || null; }

function dayTitle(D, floatIdx) {
  const { pdist, weekday, Y } = D;
  if (PASCHAL[pdist]) return PASCHAL[pdist];
  if (floatIdx === F.SunForefathers) return 'Неділя святих праотців';
  if (floatIdx === F.SunBeforeNativity || floatIdx === F.SunBeforeNativityEve) return 'Неділя перед Різдвом, святих отців';
  if (floatIdx === F.SunAfterNativitiy || floatIdx === F.SunAfterNativityMonday) return 'Неділя після Різдва';
  if (floatIdx === F.SunBeforeTheophany || floatIdx === F.SunBeforeTheophanyEve) return 'Неділя перед Богоявленням';
  if (floatIdx === F.SunAfterTheophany) return 'Неділя після Богоявлення';
  if (floatIdx === F.SunBeforeElevation) return 'Неділя перед Воздвиженням';
  if (floatIdx === F.SunAfterElevation) return 'Неділя після Воздвиження';
  if (floatIdx === F.DemetriusSaturday) return 'Димитрієва поминальна субота';
  if (pdist > -48 && pdist < -7) {
    const week = fdiv(pdist + 48, 7) + 1;
    return `${WEEKDAYS[weekday]} ${ordWeek(week)} тижня Великого посту`;
  }
  if (pdist > 0 && pdist < 7) return `${WEEKDAYS[weekday]} Світлого тижня`;
  if (pdist > 0 && pdist < 49) {
    const week = fdiv(pdist, 7) + 1;
    return `${WEEKDAYS[weekday]} ${ordWeek(week)} тижня після Пасхи`;
  }
  if (pdist > 49 && pdist < 56) return `${WEEKDAYS[weekday]} тижня Пʼятдесятниці`;
  if (pdist >= 56) {
    if (weekday === 0) return `Неділя ${ordinal(fdiv(pdist - 49, 7))} після Пʼятдесятниці`;
    return `${WEEKDAYS[weekday]} ${ordWeek(fdiv(pdist - 49, 7) + 1)} тижня після Пʼятдесятниці`;
  }
  if (pdist < -49) {
    // Тижні підготовки до посту
    if (weekday === 0) return 'Неділя підготовча до Великого посту';
    return `${WEEKDAYS[weekday]} підготовчого тижня до Великого посту`;
  }
  return WEEKDAYS[weekday];
}

// Для перевірки з консолі: lectionaryDebug(new Date(2026, 9, 21))
export async function lectionaryDebug(date, calendar) {
  const r = await readingsFor(date, calendar);
  return { ...r, main: r.main.map((x) => x.peri), extra: r.extra.map((x) => [x.src, x.desc, x.peri]) };
}
