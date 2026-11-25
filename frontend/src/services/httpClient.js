// A unique instance per browser tab prevents SignalR events from being
// mistaken for changes coming from another tab. Do not persist this value.
// A non-secret marker keeps existing Workbench auth guards compatible while
// session credentials live exclusively in HttpOnly cookies, not JavaScript.
export const BROWSER_SESSION = 'pakpost:cookie-session';
let csrfProof = '';
// Only non-secret routing metadata. The actual opaque credential stays in Rust.
let desktopContext = null;
export function setDesktopContext(value) { desktopContext = value || null; }
export function getDesktopContext() { return desktopContext; }
export function setBrowserCsrf(proof) { csrfProof = typeof proof === 'string' ? proof : ''; }
export function getBrowserCsrf() { return csrfProof; }

export const CLIENT_INSTANCE_ID =
  globalThis.crypto?.randomUUID?.() || `tab-${Math.random().toString(36).slice(2)}`;

/**
 * Existing PakPost API response and error contract, extracted from App.jsx.
 * Keep workspace mutation headers and error.status intact: revision conflict
 * handling and existing authorization paths rely on them.
 */
export async function api(path, method = 'GET', body, token = '', {signal} = {}) {
  if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__ && (path.startsWith('/api/') || path.startsWith('/hubs/'))) {
    if (!window.__PAKPOST_DESKTOP_REMOTE__ || !path.startsWith('/api/')) {
      throw new Error('Desktop Local Mode: Cloud API is disabled. Use Desktop Native for API requests.');
    }
    // All authenticated API requests are made by Rust to the selected HTTPS
    // origin. The opaque session token never enters the JS or WebView runtime.
    const context = desktopContext;
    if (!context) throw new Error('Desktop session is not connected. Sign in again.');
    let result;
    try {
      const {invoke} = await import('@tauri-apps/api/core');
      result = await invoke('remote_api', {context, path, method, body: body === undefined ? null : body});
    } catch (reason) {
      throw new Error(String(reason));
    }
    if (context !== desktopContext) throw new Error('Remote connection changed');
    if (result.status === 401) window.dispatchEvent(new Event('pakpost:desktop-session-expired'));
    if (result.status < 200 || result.status >= 300) {
      const data=result.data;
      const message=data?.message || data?.detail || data?.title || `HTTP ${result.status}`;
      const error=new Error(message);
      error.status=result.status;
      error.requestId=result.requestId;
      error.retryAfter=result.retryAfter;
      throw error;
    }
    return result.data;
  }
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  // Legacy token argument remains in the API signature for old unit callers;
  // the cookie-session marker is NEVER sent in Authorization.
  if (token && token !== BROWSER_SESSION) headers.Authorization = `Bearer ${token}`;
  if (csrfProof && !['GET','HEAD','OPTIONS'].includes(method.toUpperCase()) &&
      (path.startsWith('/api/') || path.startsWith('/hubs/'))) {
    headers['X-PakPost-CSRF'] = csrfProof;
  }

  if (method !== 'GET' && path.startsWith('/api/workspaces/')) {
    headers['X-PakPost-Instance'] = CLIENT_INSTANCE_ID;
  }

  const response = await fetch(path, {
    method,
    headers,
    signal,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const messages = Array.isArray(data?.errors)
      ? data.errors.map(error => error.message || String(error))
      : data?.errors && typeof data.errors === 'object'
        ? Object.entries(data.errors).flatMap(([key, values]) =>
            (Array.isArray(values) ? values : [values]).map(message => `${key}: ${message}`))
        : [];

    const error = new Error(
      data?.message || data?.detail || messages.join(', ') || data?.title || `HTTP ${response.status}`,
    );
    error.status = response.status;
    error.requestId = response.headers?.get?.('X-Request-ID') || null;
    error.retryAfter = response.headers?.get?.('Retry-After') || null;
    throw error;
  }

  return data;
}
