import { useEffect, useState } from 'react';
import { normalizeAppearance, readAppearance } from '../services/appearance.js';

/** Keep the preferred theme in sync without binding UI layout to storage. */
export function useWorkbenchTheme() {
  const [theme, setTheme] = useState(() => readAppearance(localStorage));
  useEffect(() => {
    document.documentElement.dataset.theme = normalizeAppearance(theme);
    try { localStorage.setItem('pakpost_theme', normalizeAppearance(theme)); } catch {}
  }, [theme]);
  return {theme, setTheme};
}
