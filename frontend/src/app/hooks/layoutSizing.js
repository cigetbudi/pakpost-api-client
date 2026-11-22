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
