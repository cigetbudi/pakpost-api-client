/** Pakpost appearance presets. Use stable identifiers in localStorage. */
export const APPEARANCE_KEY = 'pakpost_theme';

export const APPEARANCE_THEMES = Object.freeze([
  { id: 'light', name: 'Light Blue', description: 'Soft white · cool blue', mode: 'light', swatches: ['#f4f7fb', '#ffffff', '#dce7f4', '#276fc5'] },
  { id: 'dark', name: 'Dark Blue', description: 'Slate · cobalt', mode: 'dark', swatches: ['#101923', '#172331', '#293e52', '#66aaff'] },
  { id: 'dark-pink', name: 'Dark Pink', description: 'Ink · muted rose', mode: 'dark', swatches: ['#17151c', '#211d27', '#443140', '#e68eae'] },
  { id: 'dark-green', name: 'Dark Green', description: 'Pine · sea glass', mode: 'dark', swatches: ['#101b1b', '#172626', '#2b4340', '#65c9b3'] },
  { id: 'oled', name: 'OLED Black', description: 'True black · electric blue', mode: 'dark', swatches: ['#000000', '#090c10', '#263242', '#65a8ff'] },
]);

export function normalizeAppearance(value) {
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
