import { isTauriDesktop } from '../../collections/services/desktopLocalRepository.js';

const invoke = async (command, args) => (await import('@tauri-apps/api/core')).invoke(command, args);
const LEGACY_KEY = 'pakpost_guest_envs';

function stripSecretValues(environments) {
  if (!Array.isArray(environments)) throw new Error('Invalid local environment data');
  return environments.map(env => ({
    ...env,
    variables: (Array.isArray(env.variables) ? env.variables : []).map(variable =>
      variable.isSecret ? { ...variable, value: '' } : variable),
  }));
}

function readLegacyLocalEnvironments() {
  // Older desktop builds stored Local environments in WebView localStorage.
  // Keep it untouched as a recovery source; never delete it automatically.
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return [];
  return stripSecretValues(JSON.parse(raw));
}

export async function loadDesktopEnvironments() {
  if (!isTauriDesktop()) return null;
  const snapshot = await invoke('load_local_environments');
  if (snapshot != null && (snapshot.version !== 1 || !Array.isArray(snapshot.environments))) {
    throw new Error('Invalid desktop environment snapshot (SQLite not overwritten)');
  }
  const stored = snapshot == null ? [] : stripSecretValues(snapshot.environments);
  if (stored.length) return stored;

  // Recovery for D3 installations that wrote an empty SQLite snapshot while
  // the pre-D3 localStorage data was still available. Persist BEFORE returning
  // so the controller cannot autosave an empty list over a recovered list.
  const legacy = readLegacyLocalEnvironments();
  if (!legacy.length) return stored;
  await saveDesktopEnvironments(legacy);
  return legacy;
}

export async function saveDesktopEnvironments(environments) {
  if (!isTauriDesktop()) return;
  await invoke('save_local_environments', {
    snapshot: { version: 1, environments: stripSecretValues(environments) },
  });
}
