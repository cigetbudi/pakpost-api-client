/** Temporary variables scoped to account/workspace/collection or a standalone tab.
 * They are deliberately never written to localStorage, Neon, or exports.
 */
export function collectionVariableKey(source, tabId, userId = '') {
  if (!source?.collectionId) return `standalone:${userId}:${tabId}`;
  return source.scope === 'workspace'
    ? `workspace:${userId}:${source.workspaceId}:${source.collectionId}`
    : `local:${userId}:${source.collectionId}`;
}

export function readCollectionVariables(store, key, saved = {}) {
  // A materialized session snapshot includes explicit unsets; do not restore deleted
  // saved keys when a later request runs.
  return store.has(key) ? { ...store.get(key) } : { ...saved };
}

export function resetCollectionVariables(store, key) {
  store.delete(key);
}

export const collectionVariableName = /^[A-Za-z_][A-Za-z0-9_]*$/;
export function validateCollectionVariableRows(rows) {
  if (!Array.isArray(rows) || rows.length > 100) throw Error('Maximum 100 collection variables.');
  const seen = new Set();
  return rows.map(row => {
    const key = String(row.key || '').trim();
    if (!collectionVariableName.test(key) || key.length > 120) throw Error(`Invalid variable name: ${key || '(empty)'}`);
    const lowered = key.toLowerCase();
    if (seen.has(lowered)) throw Error(`Duplicate variable name: ${key}`);
    seen.add(lowered);
    const value = String(row.value ?? '');
    if (value.length > 8192) throw Error(`${key} exceeds 8192 characters.`);
    return { key, value, isSecret: !!row.isSecret, isRedacted: !!row.isRedacted };
  });
}

export function savedCollectionVariableMap(rows = []) {
  return Object.fromEntries(rows.filter(v => v?.key && !v.isRedacted)
    .map(v => [v.key, String(v.value ?? '')]));
}


export function writeCollectionVariables(store, key, variables) {
  if (!key || !variables || typeof variables !== 'object') return;
  const normalized = Object.fromEntries(Object.entries(variables).map(([name, value]) => [name, String(value)]));
  store.set(key, normalized);
}

export function resolvedScriptVariables(collection, environment, local = {}) {
  // Postman precedence among these scopes: local > environment > collection.
  return { ...collection, ...environment, ...local };
}
