import {useRef, useState} from 'react';
import {clampExplorerWidth} from './layoutSizing.js';

// Keep interaction state in the Explorer rather than in the request controller.
export function useExplorerPanelLayout({cachedExplorerTab, cachedSidebarCollapsed, setPage}) {
  const [explorerTab, setExplorerTab] = useState(
    ['collections', 'environments', 'history', 'code', 'exchange'].includes(cachedExplorerTab)
      ? cachedExplorerTab : 'collections');
  const [explorerSearch, setExplorerSearch] = useState('');
  const [rightWidth, setRightWidth] = useState(() =>
    clampExplorerWidth(Number(localStorage.getItem('pakpost_v14_right_width')) || 340));
  const resizingRight = useRef(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(cachedSidebarCollapsed || false);

  function openContext(view) {
    setExplorerTab(view);
    setSidebarCollapsed(false);
    setPage('tester');
  }

  function resizeRight(event) {
    if (!resizingRight.current) return;
    setRightWidth(clampExplorerWidth(window.innerWidth - event.clientX - 4));
  }

  function endRightResize(event) {
    if (!resizingRight.current) return;
    resizingRight.current = false;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer may already be released */ }
  }

  return {
    explorerTab, setExplorerTab, explorerSearch, setExplorerSearch,
    rightWidth, setRightWidth, resizingRight, sidebarCollapsed, setSidebarCollapsed,
    openContext, resizeRight, endRightResize,
  };
}
