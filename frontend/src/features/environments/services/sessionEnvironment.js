/**
 * Temporary overrides for read-only Cloud environments.
 * Values live only in the in-memory App instance: never localStorage, sessionStorage,
 * workspace cache, or Cloud API. The context key includes the account + workspace.
 */
export function sessionEnvironmentKey(context, environmentId) {
  if (!/^workspace:[A-Za-z0-9_-]{1,128}:[A-Za-z0-9_-]{1,128}$/.test(String(context || '')) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(String(environmentId || ''))) return '';
  return `${context}:${environmentId}`;
}

/** Only unredacted variables are supplied to the browser request executor. */
export function readableEnvironmentValues(environment) {
  return Object.fromEntries((environment?.variables || [])
    .filter(variable => variable?.key && !variable.isRedacted)
    .map(variable => [variable.key, String(variable.value ?? '')]));
}

/** Null means an explicit pm.environment.unset, not an empty string. */
export function applySessionOverrides(base, overrides = {}) {
  const result = {...base};
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) delete result[key];
    else result[key] = String(value);
  }
  return result;
}

/**
 * Calculate overrides relative to the server's original, readable values.
 * Repeated script executions must preserve previous set/unset changes without
 * ever sending a write request or exposing any redacted server-side secret.
 */
export function sessionOverridesFromValues(base, nextValues) {
  const overrides = {};
  const next = nextValues || {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(next)])) {
    if (!Object.hasOwn(next, key)) {
      if (Object.hasOwn(base, key)) overrides[key] = null;
    } else if (!Object.hasOwn(base, key) || String(next[key]) !== String(base[key])) {
      overrides[key] = String(next[key]);
    }
  }
  return overrides;
}

/** Bound the RAM-only cache; the oldest environment session is evicted first. */
export function storeSessionOverrides(store, key, overrides, limit = 100) {
  if (!key) return false;
  const before = store.get(key) || {};
  if (JSON.stringify(before) === JSON.stringify(overrides)) return false;
  store.delete(key);
  if (Object.keys(overrides).length) store.set(key, overrides);
  while (store.size > limit) store.delete(store.keys().next().value);
  return true;
}
