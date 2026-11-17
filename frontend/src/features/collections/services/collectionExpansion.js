/** Independent disclosure state for saved collections. This never mutates collection data. */
export const workspaceCollectionKey = (workspaceId, collectionId) => `${workspaceId}:${collectionId}`;

export function isWorkspaceCollectionOpen(expanded, workspaceId, collectionId, selectedId) {
  const key = workspaceCollectionKey(workspaceId, collectionId);
  return expanded[key] ?? (collectionId === selectedId);
}

export function toggleWorkspaceCollection(expanded, workspaceId, collectionId, selectedId) {
  const next = { ...expanded };
  // Preserve the previously selected collection when another one is opened.
  if (selectedId) {
    const priorKey = workspaceCollectionKey(workspaceId, selectedId);
    if (next[priorKey] === undefined) next[priorKey] = true;
  }
  const key = workspaceCollectionKey(workspaceId, collectionId);
  next[key] = !isWorkspaceCollectionOpen(next, workspaceId, collectionId, selectedId);
  return next;
}

export function setAllWorkspaceCollections(expanded, workspaceId, collectionIds, open) {
  const next = { ...expanded };
  for (const id of collectionIds) next[workspaceCollectionKey(workspaceId, id)] = open;
  return next;
}

/** Keys also include nested folders, so Expand all / Collapse all work recursively. */
export function collectLocalExpansionKeys(collections) {
  const keys = [];
  for (const collection of collections || []) {
    keys.push(`collection:${collection.id}`);
    const seen = new Set();
    for (const request of collection.requests || []) {
      const path = [];
      for (const segment of request.folderPath || []) {
        path.push(segment);
        const key = `${collection.id}:${JSON.stringify(path)}`;
        if (!seen.has(key)) { seen.add(key); keys.push(key); }
      }
    }
  }
  return keys;
}
