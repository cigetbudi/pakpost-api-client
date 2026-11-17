import { createStore } from 'zustand/vanilla';

// Memory-only per Workbench. Environment secret values must never be written
// to a generic Zustand persist/localStorage middleware.
const resolveUpdate = (update, previous) => typeof update === 'function' ? update(previous) : update;

export function createEnvironmentWorkbenchStore(initial = {}) {
  return createStore((set) => ({
    localEnvironments: initial.localEnvironments ?? [],
    workspaceEnvironmentResult: { context: '', items: [] },
    environmentSelections: initial.environmentSelections ?? {},
    setLocalEnvironments: (update) => set(s => ({ localEnvironments: resolveUpdate(update, s.localEnvironments) })),
    setWorkspaceEnvironmentResult: (update) => set(s => ({ workspaceEnvironmentResult: resolveUpdate(update, s.workspaceEnvironmentResult) })),
    setEnvironmentSelections: (update) => set(s => ({ environmentSelections: resolveUpdate(update, s.environmentSelections) })),
    // Clear Cloud data when access context ends, but keep unrelated Local
    // environments/selections. Caller is responsible for async fetch guards.
    clearWorkspaceEnvironments: () => set({ workspaceEnvironmentResult: { context: '', items: [] } }),
  }));
}
