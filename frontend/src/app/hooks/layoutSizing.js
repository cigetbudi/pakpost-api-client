/** Pure layout calculations, shared by the Explorer and request splitter. */
export function clampExplorerWidth(value) {
  return Math.min(650, Math.max(280, value));
}

export function clampSplitPercent(value) {
  return Math.min(78, Math.max(22, value));
}

export function splitPercentForPointer(bounds, split, pointer, wideViewport) {
  const sideBySide = split === 'vertical' && wideViewport;
  const value = sideBySide
    ? ((pointer.clientX - bounds.left) / bounds.width) * 100
    : ((pointer.clientY - bounds.top) / bounds.height) * 100;
  return clampSplitPercent(value);
}

// Keyboard direction follows the visible separator, not the saved layout mode.
export function splitPercentForKey(value, key, split, largeStep = false) {
  if (key === 'Home') return 22;
  if (key === 'End') return 78;
  const decrease = split === 'vertical' ? 'ArrowLeft' : 'ArrowUp';
  const increase = split === 'vertical' ? 'ArrowRight' : 'ArrowDown';
  if (key !== decrease && key !== increase) return null;
  return clampSplitPercent(value + (key === increase ? 1 : -1) * (largeStep ? 10 : 2));
}

export function readSplitPercent(storage) {
  try {
    const raw = storage?.getItem('pakpost_split_percent');
    if (raw == null || !raw.trim()) return 50;
    const value = Number(raw);
    return Number.isFinite(value) ? clampSplitPercent(value) : 50;
  } catch { return 50; }
}
