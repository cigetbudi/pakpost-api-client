import {useEffect, useRef, useState} from 'react';
import {readSplitPercent, splitPercentForPointer} from './layoutSizing.js';

export function useRequestSplitLayout({cachedSplit}) {
  const [split, setSplit] = useState(() => cachedSplit || localStorage.getItem('pakpost_split') || 'horizontal');
  const [splitPercent, setSplitPercent] = useState(() => readSplitPercent(localStorage));
  const panesRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    try { localStorage.setItem('pakpost_split', split); } catch { /* Storage may be unavailable. */ }
  }, [split]);

  // Debounce writes during dragging; keyboard changes and reset use the same state.
  useEffect(() => {
    const id = setTimeout(() => {
      try { localStorage.setItem('pakpost_split_percent', String(splitPercent)); } catch { /* optional preference */ }
    }, 150);
    return () => clearTimeout(id);
  }, [splitPercent]);

  function onSplitterMove(event) {
    if (!draggingRef.current || !panesRef.current) return;
    const bounds = panesRef.current.getBoundingClientRect();
    const wideViewport = window.matchMedia('(min-width: 981px)').matches;
    setSplitPercent(splitPercentForPointer(bounds, split, event, wideViewport));
  }

  function onSplitterEnd(event) {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return {
    split, setSplit, splitPercent, setSplitPercent,
    panesRef, draggingRef, onSplitterMove, onSplitterEnd,
  };
}
