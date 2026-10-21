// Озвучення тексту через Web Speech API (голос пристрою). Читаємо вірш за віршем,
// щоб підсвічувати поточний і щоб Chrome не обривав довгі фрази.
import { h, icon, toast } from './ui.js';
import { state } from './store.js';

let current = null; // { container, queue, i, onStop }

export const ttsSupported = () => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

function voices() {
  return new Promise((resolve) => {
    const v = speechSynthesis.getVoices();
    if (v.length) { resolve(v); return; }
    const t = setTimeout(() => resolve(speechSynthesis.getVoices()), 1200);
    speechSynthesis.addEventListener('voiceschanged', () => { clearTimeout(t); resolve(speechSynthesis.getVoices()); }, { once: true });
  });
}

export async function voiceFor(lang = 'uk') {
  const list = await voices();
  return list.find((v) => v.lang?.toLowerCase().startsWith(lang) && /natural|online|google/i.test(v.name))
    || list.find((v) => v.lang?.toLowerCase().startsWith(lang)) || null;
}

const verseText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/́/g, '').trim();

export function stopSpeaking() {
  if (!current) return;
  const c = current;
  current = null;
  speechSynthesis.cancel();
  c.container.querySelectorAll('.v.speaking').forEach((v) => v.classList.remove('speaking'));
  c.onStop?.();
}

export async function speak(container, { onStop } = {}) {
  stopSpeaking();
  if (!ttsSupported()) { toast('Цей браузер не вміє озвучувати текст'); onStop?.(); return false; }
  const voice = await voiceFor('uk');
  if (!voice) {
    toast('На пристрої немає українського голосу. Його можна додати в налаштуваннях мовлення системи.');
    onStop?.();
    return false;
  }
  const queue = [...container.querySelectorAll('.v')];
  current = { container, queue, i: 0, onStop };
  const me = current;
  const next = () => {
    if (current !== me) return;
    queue[me.i - 1]?.classList.remove('speaking');
    if (me.i >= queue.length) { stopSpeaking(); return; }
    const el = queue[me.i++];
    const text = verseText(el);
    if (!text) { next(); return; }
    el.classList.add('speaking');
    if (el.getBoundingClientRect().top > innerHeight * 0.8 || el.getBoundingClientRect().bottom < 60) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = state.settings.ttsRate || 1;
    u.onend = next;
    u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') next(); };
    speechSynthesis.speak(u);
  };
  next();
  return true;
}

// Кнопка «Слухати / Зупинити» для контейнера з віршами
export function listenButton(getContainer, { small = true } = {}) {
  const label = h('span', {}, 'Слухати');
  const btn = h('button', { class: `btn ghost${small ? ' small' : ''} listen-btn`, 'aria-pressed': 'false' }, icon('play'), label);
  const reset = () => { btn.setAttribute('aria-pressed', 'false'); label.textContent = 'Слухати'; btn.querySelector('.i').innerHTML = icon('play').innerHTML; };
  btn.addEventListener('click', async () => {
    if (btn.getAttribute('aria-pressed') === 'true') { stopSpeaking(); return; }
    btn.setAttribute('aria-pressed', 'true');
    label.textContent = 'Зупинити';
    btn.querySelector('.i').innerHTML = icon('stop').innerHTML;
    const ok = await speak(getContainer(), { onStop: reset });
    if (!ok) reset();
  });
  return btn;
}

window.addEventListener('hashchange', stopSpeaking);
