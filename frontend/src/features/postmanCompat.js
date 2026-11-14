import { bodyFormat, resolveVars } from './requestTools.js';

/** Produce the Postman-style shape used by pre-request scripts. */
export function postmanRequestSnapshot({ method, url, headers, body, format }, variables = {}) {
  let resolvedUrl = String(url || '');
  try { resolvedUrl = resolveVars(resolvedUrl, variables).value; } catch { /* Pre-script may define URL variables later. */ }
  let path = '';
  try {
    path = new URL(resolvedUrl).pathname;
  } catch {
    // Work with URLs such as {{baseUrl}}/api/v1/items before the variable exists.
    path = resolvedUrl.replace(/^\s*(?:\{\{[^{}]+\}\}|<<[^<>]+>>)/, '')
      .replace(/^[a-z]+:\/\/[^/]+/i, '')
      .split(/[?#]/, 1)[0];
  }
  const formatMode = bodyFormat(format).mode;
  return {
    method: String(method || 'GET').toUpperCase(),
    url: { raw: String(url || ''), path: path.split('/').filter(Boolean) },
    headers: { ...(headers || {}) },
    body: formatMode === 'raw' ? { mode: 'raw', raw: String(body ?? '') } : null,
  };
}
