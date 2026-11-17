/** Return focus to a Cloud tree row after its inline rename input disappears. */
export function restoreCloudFolderFocus(root, key, doc) {
  if (!root || !key) return false;
  const active = doc?.activeElement;
  if (active && active !== doc?.body && active.isConnected) return false;
  const row = Array.from(root.querySelectorAll('[data-cloud-select-key]') || [])
    .find(element => element.dataset.cloudSelectKey === key);
  if (!row?.isConnected || row.closest?.('[inert], [aria-hidden="true"]')) return false;
  row.focus({ preventScroll: true });
  return true;
}
