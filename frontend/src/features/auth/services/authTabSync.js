/**
 * Share the existing short-lived bearer session only between live same-origin tabs.
 * Never put the bearer in localStorage, URL parameters, or a persistent cache.
 * The server remains the source of truth: /api/auth/me validates adopted tokens.
 */
export const AUTH_TAB_CHANNEL = 'pakpost:auth-session:v1';

const freshId = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Non-secret correlation value for sign-out messages; NOT an auth proof.
export function sessionFingerprint(token) {
  if (!token) return '';
  let value = 2166136261;
  for (let i = 0; i < token.length; i++) {
    value = Math.imul(value ^ token.charCodeAt(i), 16777619);
  }
  return `${token.length}:${(value >>> 0).toString(16)}`;
}

/** Injectable channel factory keeps the protocol testable without a browser. */
export function createAuthTabSync({getToken, acceptToken, onRemoteLogout,
  Channel = typeof BroadcastChannel === 'undefined' ? null : BroadcastChannel,
  makeId = freshId} = {}) {
  const noop = {requestSession(){}, announceSession(){}, announceLogout(){}, close(){}};
  if (!Channel || typeof getToken !== 'function' || typeof acceptToken !== 'function') return noop;
  let channel;
  try { channel = new Channel(AUTH_TAB_CHANNEL); } catch { return noop; }
  const id = makeId();
  let pending = null;
  let closed = false;
  const send = message => {if (!closed) {try {channel.postMessage({...message, source:id});} catch { /* no broadcast support */ }}};

  const requestSession = () => {
    if (closed || getToken()) return;
    pending = makeId();
    send({type:'session-request', nonce:pending});
  };
  channel.onmessage = event => {
    const msg = event?.data;
    if (closed || !msg || typeof msg !== 'object' || msg.source === id) return;
    if (msg.type === 'session-request') {
      const token = getToken();
      if (token && typeof msg.nonce === 'string' && typeof msg.source === 'string') {
        send({type:'session-response', target:msg.source, nonce:msg.nonce, token});
      }
    } else if (msg.type === 'session-response') {
      if (msg.target !== id || !pending || msg.nonce !== pending || getToken()) return;
      if (typeof msg.token !== 'string' || !msg.token || msg.token.length > 8192) return;
      pending = null;
      acceptToken(msg.token);
    } else if (msg.type === 'session-available') {
      if (!getToken()) requestSession();
    } else if (msg.type === 'session-ended') {
      // Also cancel in-flight handshakes so a late response cannot re-login us.
      pending = null;
      if (msg.fingerprint && msg.fingerprint === sessionFingerprint(getToken())) onRemoteLogout?.();
    }
  };
  return {
    requestSession,
    announceSession() { pending = null; send({type:'session-available'}); },
    announceLogout(token) { pending = null; if (token) send({type:'session-ended',fingerprint:sessionFingerprint(token)}); },
    close() { closed = true; pending = null; channel.onmessage = null; channel.close(); },
  };
}
