const MAX_BATCH = 100;
const DEBOUNCE_MS = 180;

/** Keep a bounded *per dispatch* workload while ensuring queued events drain.
 * Awaiting a batch prevents stale, concurrent REST reconciliation responses.
 */
export function scheduleWorkspaceBatch(queueRef, timerRef, handlerRef, delay = DEBOUNCE_MS) {
  if (timerRef.current) return;
  let handle;
  const flush = async () => {
    const batch = queueRef.current.splice(0, MAX_BATCH);
    try {
      if (batch.length) await handlerRef.current?.(batch);
    } catch { /* A later notification may recover the REST state. */ }
    // Logout/workspace switch invalidates the old timer. Never drain events
    // after that reset or interfere with a new workspace's scheduled batch.
    if (timerRef.current !== handle) return;
    timerRef.current = null;
    if (queueRef.current.length) scheduleWorkspaceBatch(queueRef, timerRef, handlerRef, 0);
  };
  handle = setTimeout(flush, delay);
  timerRef.current = handle;
}
