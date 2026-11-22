/** Non-secret connection profiles. Authentication tokens MUST NEVER be stored here. */
export const PUBLIC_ORIGIN = 'https://pakpost.duckdns.org';
export const MODES = Object.freeze({ LOCAL: 'local', PUBLIC: 'public', SELF_HOSTED: 'selfHosted' });

/** Validate the authority only; no URL path, query, fragment, credentials or insecure HTTPS downgrade. */
export function normalizeServerOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Server URL is required');
  let parsed;
  try { parsed = new URL(value.trim()); } catch { throw new Error('Invalid server URL'); }
  if (parsed.protocol !== 'https:') throw new Error('Custom servers require HTTPS');
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/')
    throw new Error('Use a server origin only, without credentials, path, query or fragment');
  if (!parsed.hostname) throw new Error('Hostname required');
  return parsed.origin;
}
export function createLocalProfile(id = 'local') {
  return { id, mode: MODES.LOCAL, name: 'Local Workspace', origin: null };
}
export function createPublicProfile(id = 'pakpost-public') {
  return { id, mode: MODES.PUBLIC, name: 'PakPost Cloud', origin: PUBLIC_ORIGIN };
}
export function createSelfHostedProfile({id, name, origin}) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error('Invalid profile id');
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new Error('Invalid profile name');
  return { id, mode: MODES.SELF_HOSTED, name: name.trim(), origin: normalizeServerOrigin(origin) };
}
export function isRemoteProfile(profile) {
  return profile?.mode === MODES.PUBLIC || profile?.mode === MODES.SELF_HOSTED;
}
