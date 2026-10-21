// Нагадування про читання.
// 1) Найнадійніше — щоденна подія в календарі телефону (.ics з RRULE і сигналом).
// 2) Сповіщення браузера: поки застосунок відкритий, а також через periodic background sync,
//    якщо браузер його підтримує (Chrome для встановленого PWA). Без сервера точного розкладу не буде.
import { h } from './ui.js';
import { state, save, todayKey } from './store.js';

const META_CACHE = 'slovo-meta';
let timer = null;

export const notificationsSupported = () => 'Notification' in window && 'serviceWorker' in navigator;

export async function enableNotifications() {
  if (!notificationsSupported()) return 'unsupported';
  const res = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (res === 'granted') await registerPeriodic();
  return res;
}

async function registerPeriodic() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg) {
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state === 'granted') await reg.periodicSync.register('slovo-reminder', { minInterval: 6 * 60 * 60 * 1000 });
    }
  } catch { /* необов'язково */ }
}

// Передаємо service worker'у час нагадування й дату останнього читання (він не бачить localStorage)
export async function syncReminderMeta() {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open(META_CACHE);
    const keys = Object.keys(state.activity).sort();
    await cache.put('reminder.json', new Response(JSON.stringify({
      ...state.reminder, lastActive: keys[keys.length - 1] || null, updated: Date.now(),
    }), { headers: { 'Content-Type': 'application/json' } }));
  } catch { /* кеш недоступний */ }
}

// Нагадування, поки застосунок відкритий або у фоні на вкладці
export function scheduleInApp() {
  clearTimeout(timer);
  const r = state.reminder;
  if (!r.enabled || !notificationsSupported() || Notification.permission !== 'granted') return;
  const [hh, mm] = r.time.split(':').map(Number);
  const now = new Date();
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
  if (at <= now) at.setDate(at.getDate() + 1);
  timer = setTimeout(async () => {
    if (!state.activity[todayKey()]) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification('Слово на кожен день', {
        body: 'Знайди 10 хвилин для сьогоднішнього читання.', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'slovo-reminder',
      });
    }
    scheduleInApp();
  }, Math.min(at - now, 2 ** 31 - 1));
}

export function setReminder(patch) {
  Object.assign(state.reminder, patch);
  save(true);
  syncReminderMeta();
  scheduleInApp();
}

// Файл календаря з щоденною подією о вибраний час
export function downloadIcs() {
  const [hh, mm] = state.reminder.time.split(':');
  const start = new Date();
  start.setDate(start.getDate() + 1);
  const d = `${start.getFullYear()}${String(start.getMonth() + 1).padStart(2, '0')}${String(start.getDate()).padStart(2, '0')}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Slovo na kozhen den//UK', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:slovo-daily-${Date.now()}@slovo.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${d}T${hh}${mm}00`,
    'DURATION:PT15M',
    'RRULE:FREQ=DAILY',
    'SUMMARY:Слово на кожен день',
    'DESCRIPTION:Час для щоденного читання: уривок\\, роздум і молитва (10–15 хв).',
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Час для Слова', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: 'slovo-nahaduvannia.ics' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function initReminders() {
  syncReminderMeta();
  scheduleInApp();
  window.addEventListener('slovo:activity', syncReminderMeta);
}
