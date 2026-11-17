import { useEffect, useState } from 'react';
import { subscribeConsoleEvents } from '../services/pakpostConsoleStore.js';

/** Console subscriptions exist only while the drawer is visible. */
export function useConsoleDrawer() {
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleEvents, setConsoleEvents] = useState([]);
  useEffect(() => {
    if (!consoleOpen) { setConsoleEvents([]); return; }
    return subscribeConsoleEvents(setConsoleEvents);
  }, [consoleOpen]);
  return { consoleOpen, setConsoleOpen, consoleEvents };
}
