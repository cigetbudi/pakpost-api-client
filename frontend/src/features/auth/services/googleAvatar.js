/* Display-only allowlist for Google profile photos. */
export function safeGoogleAvatar(url) {
  if (typeof url !== 'string' || url.length > 2048) return '';
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password &&
      (parsed.hostname === 'googleusercontent.com' || parsed.hostname.endsWith('.googleusercontent.com')) ? url : '';
  } catch { return ''; }
}
