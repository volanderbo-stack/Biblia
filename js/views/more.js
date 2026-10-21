import { h, icon, toast } from '../ui.js';
import { state, save, updateSettings } from '../store.js';
import { textSettingsPanel } from './text-settings.js';
import { offlineStatus, prefetchAll } from '../offline.js';
import { journal, verseMarks } from '../db.js';
import { setReminder, downloadIcs, enableNotifications, notificationsSupported } from '../reminders.js';
import { ttsSupported, voiceFor } from '../tts.js';

const PRESETS = [['07:00', 'Ранок'], ['13:00', 'День'], ['21:00', 'Вечір']];

export async function render() {
  const cleanups = [];

  // ── Офлайн: український текст і (за бажанням) французький
  function offlineRow(lang, title) {
    const status = h('small', {}, 'Перевіряю…');
    const bar = h('i', { style: { width: '0%' } });
    const btn = h('button', { class: 'btn small ghost', hidden: true, onclick: run }, icon('download'), 'Зберегти на пристрій');
    const show = (done, total) => {
      bar.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
      status.textContent = done >= total ? 'Доступно без інтернету' : `Збережено ${done} з ${total} книг`;
      btn.hidden = done >= total;
    };
    async function run() {
      btn.disabled = true;
      try { await prefetchAll(lang, show); } catch { toast('Немає зʼєднання — спробуй пізніше'); } finally { btn.disabled = false; }
    }
    offlineStatus(lang).then(({ done, total }) => show(done, total)).catch(() => { status.textContent = 'Недоступно в цьому браузері'; });
    const onProgress = (e) => { if (e.detail.lang === lang) show(e.detail.done, e.detail.total); };
    window.addEventListener('offline-progress', onProgress);
    cleanups.push(() => window.removeEventListener('offline-progress', onProgress));
    return h('div', { class: 'setting' },
      h('div', { class: 'label' }, title, status),
      h('div', { class: 'progress' }, bar),
      h('div', { style: { marginTop: '12px' } }, btn));
  }

  // ── Нагадування
  const r = state.reminder;
  const timeInput = h('input', { type: 'time', value: r.time, class: 'time-input', 'aria-label': 'Час нагадування', onchange: (e) => pickTime(e.target.value) });
  const presetBtns = PRESETS.map(([t, label]) => h('button', { 'aria-pressed': String(r.time === t), onclick: () => pickTime(t) }, label, h('small', {}, t)));
  function pickTime(t) {
    timeInput.value = t;
    presetBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(PRESETS[i][0] === t)));
    setReminder({ time: t });
  }
  const notifStatus = h('p', { class: 'hint' });
  const updateNotif = () => {
    notifStatus.textContent = !notificationsSupported() ? 'Цей браузер не підтримує сповіщення — скористайся календарем.'
      : Notification.permission === 'granted' ? 'Сповіщення дозволені. Вони надійно приходять, коли застосунок відкритий або встановлений на головний екран; точніше працює календар.'
        : Notification.permission === 'denied' ? 'Сповіщення заборонені в налаштуваннях браузера.' : '';
  };
  updateNotif();
  const reminderToggle = toggle('Нагадувати щодня', 'Ніжне нагадування, якщо сьогодні ще не читав', state.reminder.enabled, async (on) => {
    setReminder({ enabled: on });
    if (on && notificationsSupported() && Notification.permission === 'default') { await enableNotifications(); updateNotif(); setReminder({}); }
  });

  // ── Озвучення
  const voiceStatus = h('small', {}, ttsSupported() ? 'Перевіряю голос…' : 'не підтримується');
  if (ttsSupported()) voiceFor('uk').then((v) => { voiceStatus.textContent = v ? v.name : 'немає українського голосу'; });
  const rateBtns = [[0.8, 'Повільно'], [1, 'Звично'], [1.2, 'Швидше']].map(([v, label]) => h('button', {
    'aria-pressed': String(state.settings.ttsRate === v),
    onclick: (e) => { updateSettings({ ttsRate: v }); rateBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); },
  }, label));

  const el = h('div', { class: 'view-enter' },
    h('header', { class: 'page-head' },
      h('div', { class: 'eyebrow' }, 'Налаштування'),
      h('h1', {}, 'Ще')),

    h('nav', { class: 'more-links' },
      link('#/journal', 'journal', 'Щоденник', 'Роздуми й нотатки'),
      link('#/marks', 'bookmark', 'Закладки й виділення', 'Позначені вірші'),
      link('#/search', 'search', 'Пошук', 'За словом у Біблії'),
      link('#/lectio', 'moon', 'Повільне читання', 'Lectio Divina'),
      link('#/progress', 'award', 'Мій прогрес', 'Календар і досягнення')),

    h('h2', { class: 'section-title' }, 'Вигляд'),
    textSettingsPanel({ preview: true }),

    h('h2', { class: 'section-title' }, 'Нагадування'),
    h('div', { class: 'settings' },
      reminderToggle,
      h('div', { class: 'setting' },
        h('div', { class: 'label' }, 'Час'),
        h('div', { class: 'segmented presets' }, presetBtns),
        h('div', { class: 'time-row' }, h('span', {}, 'Або свій час:'), timeInput)),
      h('div', { class: 'setting' },
        h('div', { class: 'label' }, 'У календар телефону', h('small', {}, 'найнадійніше')),
        h('p', { class: 'hint', style: { margin: '0 0 10px' } }, 'Додасть щоденну подію з нагадуванням у твій календар (Google, Apple, Outlook).'),
        h('button', { class: 'btn small ghost', onclick: downloadIcs }, icon('calendar'), 'Додати в календар')),
      notificationsSupported() ? h('div', { class: 'setting' },
        h('div', { class: 'label' }, 'Сповіщення браузера'),
        h('button', { class: 'btn small ghost', onclick: async () => { await enableNotifications(); updateNotif(); setReminder({}); } }, icon('bell'), 'Дозволити сповіщення'),
        notifStatus) : notifStatus),

    h('h2', { class: 'section-title' }, 'Озвучення'),
    h('div', { class: 'settings' },
      h('div', { class: 'setting' },
        h('div', { class: 'label' }, 'Голос', voiceStatus),
        h('div', { class: 'segmented' }, rateBtns),
        h('p', { class: 'hint' }, 'Використовується голос пристрою. Якщо українського немає, його можна встановити в налаштуваннях мови й мовлення системи.'))),

    h('h2', { class: 'section-title' }, 'Без інтернету'),
    h('div', { class: 'settings' },
      offlineRow('uk', 'Переклад Огієнка'),
      offlineRow('fr', 'Louis Segond 1910 (фр.)')),

    h('h2', { class: 'section-title' }, 'Мої дані'),
    h('div', { class: 'settings' },
      h('div', { class: 'setting' },
        h('p', { class: 'hint', style: { margin: '0 0 10px' } }, 'Щоденник, позначки, прогрес і налаштування зберігаються лише на цьому пристрої. Зроби резервну копію, щоб перенести їх на інший.'),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn small ghost', onclick: exportData }, icon('download'), 'Зберегти копію'),
          h('label', { class: 'btn small ghost file-btn' }, icon('share'), 'Відновити з копії',
            h('input', { type: 'file', accept: 'application/json,.json', onchange: importData }))))),

    h('h2', { class: 'section-title' }, 'Про застосунок'),
    h('div', { class: 'card about' },
      h('p', {}, h('strong', {}, 'Слово на кожен день'), ' — Біблія для щоденного читання потроху: уривок, роздум, молитва.'),
      h('p', {}, h('strong', {}, 'Український текст: '), 'переклад Івана Огієнка (1962). Джерела: bolls.life та CrossWire (наголоси й лапки).'),
      h('p', {}, h('strong', {}, 'Французький текст: '), 'Louis Segond 1910, суспільне надбання (eBible.org).'),
      h('p', {}, h('strong', {}, 'Церковні читання: '), 'лекціонарій словʼянської традиції за даними orthocal (MIT, © Brian Glass).'),
      h('p', {}, h('strong', {}, 'Шрифт: '), 'Literata, SIL Open Font License.')));

  return { el, tab: 'more', title: 'Ще', destroy: () => cleanups.forEach((fn) => fn()) };
}

function link(href, ic, title, sub) {
  return h('a', { class: 'more-link', href }, icon(ic), h('span', {}, h('strong', {}, title), h('small', {}, sub)), icon('next'));
}

function toggle(label, hint, checked, onChange) {
  const input = h('input', { type: 'checkbox', role: 'switch', 'aria-label': label, onchange: (e) => onChange(e.target.checked) });
  input.checked = !!checked;
  return h('label', { class: 'setting inline' },
    h('span', { class: 'label' }, label, hint ? h('small', {}, hint) : null),
    h('span', { class: 'switch' }, input, h('span')));
}

async function exportData() {
  const data = { app: 'slovo', version: 1, exported: new Date().toISOString(), state, journal: await journal.all(), marks: await verseMarks.all() };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `slovo-kopiia-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function importData(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'slovo' || !data.state) throw new Error('format');
    if (!confirm('Відновити дані з копії? Поточний прогрес і налаштування буде замінено.')) return;
    Object.keys(state).forEach((k) => delete state[k]);
    Object.assign(state, data.state);
    save(true);
    for (const j of data.journal || []) await journal.put(j);
    for (const m of data.marks || []) await verseMarks.put(m);
    toast('Дані відновлено');
    setTimeout(() => location.reload(), 600);
  } catch {
    toast('Це не схоже на копію «Слова на кожен день»');
  }
}
