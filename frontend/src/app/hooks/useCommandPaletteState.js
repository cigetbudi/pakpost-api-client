import { useEffect, useState } from 'react';

export function useCommandPaletteState() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(v => !v);
        setCommandQuery('');
        setCommandIndex(0);
      } else if (event.key === 'Escape') setCommandOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return {commandOpen, setCommandOpen, commandQuery, setCommandQuery, commandIndex, setCommandIndex};
}
