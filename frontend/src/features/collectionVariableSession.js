/** Temporary variables scoped to account/workspace/collection or a standalone tab.
 * They are deliberately never written to localStorage, Neon, or exports.
 */
export function collectionVariableKey(source, tabId, userId = '') {
  if (!source?.collectionId) return `standalone:${userId}:${tabId}`;
  return source.scope === 'workspace'
    ? `workspace:${userId}:${source.workspaceId}:${source.collectionId}`
    : `local:${userId}:${source.collectionId}`;
}

export function readCollectionVariables(store, key) {
  return { ...(store.get(key) || {}) };
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
