// Картка «Вірш дня»: малюємо на canvas і ділимося картинкою (або завантажуємо PNG)
import { h, icon, openSheet, toast, closeSheet } from './ui.js';

const STYLES = {
  dawn: { name: 'Світанок', bg: ['#F7E3C7', '#E9B98A', '#C98258'], text: '#2B1E14', sub: '#6A4329', accent: '#FFF4E4' },
  parchment: { name: 'Пергамент', bg: ['#FBF6EC', '#F1E6D2', '#E6D5B8'], text: '#2B241E', sub: '#98582D', accent: '#98582D' },
  night: { name: 'Ніч', bg: ['#1B2030', '#232A3D', '#3A3550'], text: '#F2EAD8', sub: '#D9B27C', accent: '#D9B27C' },
  olive: { name: 'Олива', bg: ['#E8EBD9', '#C9D1AE', '#8F9C6B'], text: '#1F2614', sub: '#4C5A2A', accent: '#FBFAF2' },
};

const W = 1080, H = 1350;

function wrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function drawCard(canvas, { text, ref }, styleKey = 'dawn') {
  const s = STYLES[styleKey] || STYLES.dawn;
  await document.fonts.load('400 60px Literata');
  await document.fonts.load('italic 400 40px Literata');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  s.bg.forEach((c, i) => g.addColorStop(i / (s.bg.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // М'яке світло вгорі
  const glow = ctx.createRadialGradient(W * 0.75, H * 0.12, 20, W * 0.75, H * 0.12, W * 0.7);
  glow.addColorStop(0, 'rgba(255,255,255,0.35)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Текст: підбираємо розмір, щоб помістився
  const clean = text.replace(/́/g, '');
  let size = 64, lines;
  for (; size >= 34; size -= 2) {
    ctx.font = `400 ${size}px Literata, Georgia, serif`;
    lines = wrap(ctx, clean, W - 200);
    if (lines.length * size * 1.45 < H * 0.58) break;
  }
  const lh = size * 1.45;
  const blockH = lines.length * lh;
  let y = (H - blockH) / 2 - 40;

  ctx.fillStyle = s.accent;
  ctx.globalAlpha = 0.9;
  ctx.font = '400 150px Literata, Georgia, serif';
  ctx.fillText('„', 92, y - 10);
  ctx.globalAlpha = 1;

  ctx.fillStyle = s.text;
  ctx.font = `400 ${size}px Literata, Georgia, serif`;
  ctx.textBaseline = 'top';
  for (const l of lines) { ctx.fillText(l, 100, y); y += lh; }

  ctx.fillStyle = s.sub;
  ctx.font = '600 40px system-ui, sans-serif';
  ctx.fillText(ref, 100, y + 30);
  ctx.font = 'italic 400 30px Literata, Georgia, serif';
  ctx.fillText('пер. Івана Огієнка', 100, y + 84);

  ctx.font = '600 28px system-ui, sans-serif';
  ctx.globalAlpha = 0.75;
  ctx.fillText('СЛОВО НА КОЖЕН ДЕНЬ', 100, H - 110);
  ctx.globalAlpha = 1;
  return canvas;
}

const toBlob = (canvas) => new Promise((r) => canvas.toBlob(r, 'image/png'));

// Аркуш із попереднім переглядом і вибором стилю
export function openShareCard({ text, ref }) {
  let style = 'dawn';
  const canvas = h('canvas', { class: 'card-preview', role: 'img', 'aria-label': `Картка з віршем ${ref}` });
  const styles = h('div', { class: 'style-choice' }, Object.entries(STYLES).map(([key, s]) =>
    h('button', {
      'aria-pressed': String(key === style), title: s.name,
      style: { background: `linear-gradient(135deg, ${s.bg[0]}, ${s.bg[2]})`, color: s.text },
      onclick: (e) => {
        style = key;
        styles.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
        drawCard(canvas, { text, ref }, style);
      },
    }, s.name)));

  const shareBtn = h('button', { class: 'btn', onclick: share }, icon('share'), 'Поділитися');
  const saveBtn = h('button', { class: 'btn ghost', onclick: download }, icon('download'), 'Зберегти');

  async function share() {
    const blob = await toBlob(canvas);
    const file = new File([blob], `virsh-${ref.replace(/[^\dA-Za-zА-Яа-яІіЇїЄєҐґ]+/g, '-')}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text: `${text.replace(/́/g, '')}\n— ${ref}` }); closeSheet(); } catch { /* скасовано */ }
    } else {
      download();
    }
  }
  async function download() {
    const blob = await toBlob(canvas);
    const a = h('a', { href: URL.createObjectURL(blob), download: `virsh-dnya.png` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Картку збережено');
  }

  openSheet('Картка з віршем', h('div', { class: 'share-card' }, canvas, styles, h('div', { class: 'deck-nav' }, saveBtn, shareBtn)));
  drawCard(canvas, { text, ref }, style);
}
