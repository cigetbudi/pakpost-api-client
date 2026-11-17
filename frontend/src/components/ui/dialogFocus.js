/** Restore the launching control after a modal is actually removed.
 * Do not steal focus from a live control that the user deliberately selected. */
export function restoreDialogFocus(trigger, dialog, doc) {
  if (dialog?.isConnected || !trigger?.isConnected ||
      trigger.closest?.('[inert], [aria-hidden="true"]')) return false;
  const active = doc?.activeElement;
  if (active && active !== doc?.body && active.isConnected) return false;
  if (typeof trigger.focus !== 'function') return false;
  trigger.focus({ preventScroll: true });
  return true;
}
