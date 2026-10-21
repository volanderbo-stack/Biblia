import { h } from '../ui.js';
import { state, updateSettings } from '../store.js';

const THEMES = [
  ['auto', 'Як у системі', 'auto'],
  ['light', 'Світла', 'light'],
  ['dark', 'Нічна', 'dark'],
];

// Панель налаштувань тексту: використовується в читанні (аркуш «Аа») і на сторінці «Ще»
export function textSettingsPanel({ preview = false } = {}) {
  const s = state.settings;

  const themeBtns = THEMES.map(([value, label, cls]) =>
    h('button', {
      'aria-pressed': String(s.theme === value),
      onclick: (e) => {
        updateSettings({ theme: value });
        themeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
      },
    }, h('span', { class: `sw ${cls}` }, 'Аа'), label));

  const sizeValue = h('small', {}, `${s.fontSize} px`);
  const range = h('input', {
    type: 'range', min: 15, max: 30, step: 1, value: s.fontSize, 'aria-label': 'Розмір шрифту',
    oninput: (e) => setSize(+e.target.value),
  });
  function setSize(v) {
    v = Math.max(15, Math.min(30, v));
    range.value = v;
    sizeValue.textContent = `${v} px`;
    updateSettings({ fontSize: v });
  }

  const lhBtns = [[1.5, 'Щільно'], [1.7, 'Звично'], [1.9, 'Просторо']].map(([v, label]) =>
    h('button', {
      'aria-pressed': String(Math.abs(s.lineHeight - v) < .01),
      onclick: (e) => {
        updateSettings({ lineHeight: v });
        lhBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
      },
    }, label));

  const layoutBtns = [['flow', 'Суцільний текст'], ['lines', 'Вірш з рядка']].map(([v, label]) =>
    h('button', {
      'aria-pressed': String(s.layout === v),
      onclick: (e) => {
        updateSettings({ layout: v });
        layoutBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
      },
    }, label));

  return h('div', { class: 'settings' },
    h('div', { class: 'setting' },
      h('div', { class: 'label' }, 'Тема'),
      h('div', { class: 'theme-choice' }, themeBtns)),
    h('div', { class: 'setting' },
      h('div', { class: 'label' }, 'Розмір тексту', sizeValue),
      h('div', { class: 'stepper' },
        h('button', { 'aria-label': 'Менше', onclick: () => setSize(state.settings.fontSize - 1) }, 'А'),
        range,
        h('button', { class: 'big', 'aria-label': 'Більше', onclick: () => setSize(state.settings.fontSize + 1) }, 'А')),
      preview ? h('div', { class: 'preview-text' },
        'Слово Твоє — то світильник для ноги моєї, то світло для стежки моєї.') : null),
    h('div', { class: 'setting' },
      h('div', { class: 'label' }, 'Міжрядковий інтервал'),
      h('div', { class: 'segmented' }, lhBtns)),
    h('div', { class: 'setting' },
      h('div', { class: 'label' }, 'Вигляд тексту'),
      h('div', { class: 'segmented' }, layoutBtns)),
    toggle('Номери віршів', null, 'verseNumbers'),
    toggle('Наголоси', 'Як у виданні Огієнка: поча́ток, Єва́нгелія', 'accents'),
    toggle('Паралельно французькою', 'Louis Segond 1910 поруч із кожним віршем', 'parallel'),
  );
}

function toggle(label, hint, key) {
  const input = h('input', {
    type: 'checkbox', role: 'switch', 'aria-label': label,
    onchange: (e) => updateSettings({ [key]: e.target.checked }),
  });
  input.checked = !!state.settings[key];
  return h('label', { class: 'setting inline' },
    h('span', { class: 'label' }, label, hint ? h('small', {}, hint) : null),
    h('span', { class: 'switch' }, input, h('span')));
}
