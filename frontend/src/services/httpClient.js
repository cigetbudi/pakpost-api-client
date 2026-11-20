// A unique instance per browser tab prevents SignalR events from being
// mistaken for changes coming from another tab. Do not persist this value.
export const CLIENT_INSTANCE_ID =
  globalThis.crypto?.randomUUID?.() || `tab-${Math.random().toString(36).slice(2)}`;

/**
 * Existing PakPost API response and error contract, extracted from App.jsx.
 * Keep workspace mutation headers and error.status intact: revision conflict
 * handling and existing authorization paths rely on them.
 */
export async function api(path, method = 'GET', body, token = '', {signal} = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  if (method !== 'GET' && path.startsWith('/api/workspaces/')) {
    headers['X-PakPost-Instance'] = CLIENT_INSTANCE_ID;
  }

  const response = await fetch(path, {
    method,
    headers,
    signal,
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
