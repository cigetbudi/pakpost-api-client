import { useEffect, useRef } from 'react';

/**
 * Register keybindings once per mounted Workbench. The handler reads the latest
 * editor snapshot, avoiding window-listener churn on every keystroke.
 */
export function useWorkbenchKeyboardShortcuts({
  page, loading, busyAction, saveOpen, saveExampleOpen, actionDialog,
  documentationTarget, collectionActive=false, saveCurrent, sendRequest,
}) {
  const latest = useRef(null);
  latest.current = {
    page, loading, busyAction, saveOpen, saveExampleOpen,
    actionDialog, documentationTarget, collectionActive, saveCurrent, sendRequest,
  };

  useEffect(() => {
    const onKeyboard = e => {
      const state = latest.current;
      if(state.collectionActive)return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (state.page === 'tester' && !state.busyAction && !state.saveOpen &&
            !state.saveExampleOpen && !state.actionDialog && !state.documentationTarget) {
          state.saveCurrent();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && state.page === 'tester') {
        e.preventDefault();
        if (!state.loading) state.sendRequest();
      }
    };
    window.addEventListener('keydown', onKeyboard);
    return () => window.removeEventListener('keydown', onKeyboard);
  }, []);
}
