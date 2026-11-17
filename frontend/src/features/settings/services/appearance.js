/** Pakpost appearance presets. Theme choice is kept in browser storage. */
export const APPEARANCE_KEY = 'pakpost_theme';

export const APPEARANCE_THEMES = Object.freeze([
  { id: 'light', name: 'Light', description: 'Warm ivory · pastel blue', mode: 'light', swatches: ['#faf7f1', '#fffdf9', '#d9d0c4', '#4488de'] },
  { id: 'dark', name: 'Dark', description: 'Charcoal · soft blue', mode: 'dark', swatches: ['#1b1c21', '#282a31', '#42434c', '#8ab8ff'] },
  { id: 'oled', name: 'AMOLED', description: 'True black · crisp accents', mode: 'dark', swatches: ['#000000', '#08090b', '#282b31', '#8ab8ff'] },
]);

export function normalizeAppearance(value) {
  // Existing Dark Pink / Dark Green users migrate to Dark without losing any data.
  if (value === 'dark-pink' || value === 'dark-green') return 'dark';
  return APPEARANCE_THEMES.some(t => t.id === value) ? value : 'dark';
}

export function isDarkAppearance(value) {
  return normalizeAppearance(value) !== 'light';
}

export function nextAppearance(value) {
  return isDarkAppearance(value) ? 'light' : 'dark';
}

export function readAppearance(storage) {
  try { return normalizeAppearance(storage?.getItem(APPEARANCE_KEY)); }
  catch { return 'dark'; }
}
