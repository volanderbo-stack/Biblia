// Лінійні іконки 24×24, колір береться з currentColor
const S = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;

export const ICONS = {
  today: S('<path d="M12 3.5v2.5M5.3 7.3l1.8 1.8M18.7 7.3l-1.8 1.8M3 16.5h18M7 16.5a5 5 0 0 1 10 0M6 20h12"/>'),
  plans: S('<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4 6.5l1 1 1.8-2M4 12l1 1 1.8-2"/><circle cx="5.2" cy="17.5" r="1.1"/>'),
  bible: S('<path d="M5 4.6A1.6 1.6 0 0 1 6.6 3H19v15H6.6A1.6 1.6 0 0 0 5 19.6z"/><path d="M5 19.6A1.4 1.4 0 0 0 6.4 21H19"/><path d="M12 6.5v6.5M9.6 8.9h4.8"/>'),
  journal: S('<path d="M4 20h4.2L19 9.2a2.8 2.8 0 0 0-4-4L4.2 16z"/><path d="M13.6 6.6l3.8 3.8"/>'),
  more: S('<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>'),
  back: S('<path d="M15 5l-7 7 7 7"/>'),
  next: S('<path d="M9 5l7 7-7 7"/>'),
  down: S('<path d="M6 9.5l6 6 6-6"/>'),
  close: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  copy: S('<rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6.2A1.7 1.7 0 0 0 13.8 4.5H6.2A1.7 1.7 0 0 0 4.5 6.2v7.6a1.7 1.7 0 0 0 1.7 1.7h2.3"/>'),
  share: S('<path d="M12 15V4M8 7.5L12 4l4 3.5"/><path d="M6 12.5v5.3A1.7 1.7 0 0 0 7.7 19.5h8.6a1.7 1.7 0 0 0 1.7-1.7v-5.3"/>'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  leaf: S('<path d="M5 19c0-8 5.5-13 14-14-1 8.5-6 14-14 14z"/><path d="M5 19l7-7"/>'),
  sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>'),
  moon: S('<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>'),
  download: S('<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>'),
  play: S('<path d="M8 5.5v13l10.5-6.5z"/>'),
  stop: S('<rect x="7" y="7" width="10" height="10" rx="1.8"/>'),
  bookmark: S('<path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.8L6 20V5.5a1 1 0 0 1 1-1z"/>'),
  note: S('<path d="M5 4.5h14v10.5l-5 4.5H5z"/><path d="M14 19.5V15h5M8.5 9h7M8.5 12h4.5"/>'),
  search: S('<circle cx="11" cy="11" r="6.2"/><path d="M15.7 15.7L20 20"/>'),
  marker: S('<path d="M14.5 4.5l5 5-8.8 8.8H5.7v-5z"/><path d="M4 20.5h16"/>'),
  calendar: S('<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'),
  bell: S('<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>'),
  image: S('<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9.5" cy="10" r="1.6"/><path d="M5 17.5l4.5-4.5 3.5 3.5 2.5-2.5 3.5 3.5"/>'),
  award: S('<circle cx="12" cy="9" r="5.2"/><path d="M8.8 13.2L7.5 21l4.5-2.5 4.5 2.5-1.3-7.8"/>'),
  timer: S('<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2.5M9.5 3h5"/>'),
  globe: S('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.7 5.5 3.7 8.5s-1.2 5.9-3.7 8.5c-2.5-2.6-3.7-5.5-3.7-8.5S9.5 6.1 12 3.5z"/>'),
  trash: S('<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7"/>'),
};

export function iconHTML(name) {
  return ICONS[name] || '';
}
