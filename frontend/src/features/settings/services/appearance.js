/** Pakpost appearance presets. Theme choice is kept in browser storage. */
export const APPEARANCE_KEY = 'pakpost_theme';

export const APPEARANCE_THEMES = Object.freeze([
  { id: 'light', name: 'Light', description: 'Clean light · royal blue', mode: 'light', swatches: ['#f6f8fc', '#ffffff', '#cbd3e1', '#2b4ad6'] },
  { id: 'dark', name: 'Dark', description: 'Dark navy · blue accents', mode: 'dark', swatches: ['#0e1119', '#141925', '#303749', '#83a5ff'] },
  { id: 'oled', name: 'AMOLED', description: 'True black · crisp accents', mode: 'dark', swatches: ['#000000', '#080a10', '#303443', '#8ab1ff'] },
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
