import { iconHTML } from './icons.js';

// Невеликий помічник для створення DOM-елементів: h('a', { href, class }, 'текст', child)
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function icon(name, cls = 'i') {
  return h('span', { class: cls, html: iconHTML(name) });
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (!el.firstChild) el.innerHTML = iconHTML(el.dataset.icon);
  });
}

// Перемалювати поточний екран (app.js слухає цю подію)
export const rerender = () => window.dispatchEvent(new Event('app:rerender'));

// Нижній аркуш. Повертає функцію закриття.
let openSheetClose = null;
export function openSheet(title, content, { onClose } = {}) {
  openSheetClose?.();
  const root = document.getElementById('overlay-root');
  const scrim = h('div', { class: 'scrim' });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'grip' }), title ? h('h3', {}, title) : null, content);
  root.append(scrim, sheet);
  requestAnimationFrame(() => { scrim.classList.add('show'); sheet.classList.add('show'); });

  let startY = null;
  sheet.addEventListener('touchstart', (e) => { if (sheet.scrollTop <= 0) startY = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchend', (e) => {
    if (startY != null && e.changedTouches[0].clientY - startY > 80) close();
    startY = null;
  });
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', () => close());

  function close() {
    if (openSheetClose !== close) return;
    openSheetClose = null;
    document.removeEventListener('keydown', onKey);
    scrim.classList.remove('show'); sheet.classList.remove('show');
    setTimeout(() => { scrim.remove(); sheet.remove(); }, 300);
    onClose?.();
  }
  openSheetClose = close;
  return close;
}

export function closeSheet() { openSheetClose?.(); }

let toastTimer;
export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = h('div', { class: 'toast', role: 'status' }); document.body.append(el); }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }, text);
    document.body.append(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

// Відмінювання: plural(5, ['розділ', 'розділи', 'розділів'])
export function plural(n, [one, few, many]) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
