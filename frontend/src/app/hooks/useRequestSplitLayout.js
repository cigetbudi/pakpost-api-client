import {useEffect, useRef, useState} from 'react';
import {splitPercentForPointer} from './layoutSizing.js';

export function useRequestSplitLayout({cachedSplit}) {
  const [split, setSplit] = useState(() => cachedSplit || localStorage.getItem('pakpost_split') || 'horizontal');
  const [splitPercent, setSplitPercent] = useState(56);
  const panesRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('pakpost_split', split);
    setSplitPercent(50);
  }, [split]);

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
