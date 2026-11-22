/**
 * Pure command palette descriptors. Callbacks are injected by the Workbench;
 * this module does not read auth state, storage or global browser APIs.
 */
export function createCommandPaletteItems({
  commandOpen, addTab, setExplorerTab, setSidebarCollapsed, setPage,
  openContext, openTabs, localCollections, token, savedRequests, selectTab,
  openLocalRequest, loadSavedRequest,
}) {
  if (!commandOpen) return [];

  const showPanel = panel => {
    setExplorerTab(panel);
    setSidebarCollapsed(false);
    setPage('tester');
  };

  return [
    { key: 'new-request', title: 'New HTTP request', subtitle: 'Open an empty request tab', icon: 'action', run: () => addTab() },
    { key: 'open-collections', title: 'Show collections', subtitle: 'Browse saved API requests', icon: 'action', run: () => showPanel('collections') },
    { key: 'open-history', title: 'Open request history', subtitle: 'Previously sent requests', icon: 'action', run: () => showPanel('history') },
    { key: 'environments', title: 'Manage environments', subtitle: 'Edit local and workspace variables', icon: 'action', run: () => openContext('environments') },
    { key: 'code', title: 'Generate code', subtitle: 'cURL, Fetch, Go, C#, Python', icon: 'action', run: () => showPanel('code') },
    ...openTabs.map(tab => ({
      key: `tab-${tab.id}`, title: tab.name, subtitle: `${tab.method} · Open tab`,
      method: tab.method, run: () => selectTab(tab.id),
    })),
    ...localCollections.flatMap(collection => (collection.requests || []).map(request => ({
      key: `local-${collection.id}-${request.id}`,
      title: request.requestName || request.name || 'Untitled Request',
      subtitle: `${collection.name} · ${request.url || ''}`,
      method: request.method || 'GET',
      run: () => openLocalRequest(request, collection.id),
    }))),
    ...(token ? savedRequests.map(request => ({
      key: `neon-${request.id}`, title: request.name,
      subtitle: `Workspace · ${request.url || ''}`, method: request.method || 'GET',
      run: () => loadSavedRequest(request),
    })) : []),
  ];
}

export function filterCommandPaletteItems(items, query, limit = 30) {
  const term = query.trim().toLowerCase();
  return items.filter(item => `${item.title} ${item.subtitle}`.toLowerCase().includes(term)).slice(0, limit);
}
