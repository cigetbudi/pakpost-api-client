import { validateLibrary, safeLocalCollectionsSnapshot } from './localCollections.js';

export function isTauriDesktop() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
}

async function invoke(command, args) {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(command, args);
}

export async function loadDesktopCollections() {
  if (!isTauriDesktop()) return null;
  const state = await invoke('load_local_collections');
  if (state == null) return [];
  if (state.version !== 1 || !Array.isArray(state.collections)) throw Error('Invalid desktop collection database');
  return validateLibrary(state.collections);
}

export async function saveDesktopCollections(collections) {
  if (!isTauriDesktop()) return;
  const state = safeLocalCollectionsSnapshot(collections);
  await invoke('save_local_collections', {snapshot: state});
}
