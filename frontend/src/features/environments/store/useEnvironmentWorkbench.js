import { useStore } from 'zustand';

// Stable slice selectors avoid object-identity loops in Zustand v5.
export function useEnvironmentWorkbench(store) {
  const localEnvironments = useStore(store, s => s.localEnvironments);
  const setLocalEnvironments = useStore(store, s => s.setLocalEnvironments);
  const workspaceEnvironmentResult = useStore(store, s => s.workspaceEnvironmentResult);
  const setWorkspaceEnvironmentResult = useStore(store, s => s.setWorkspaceEnvironmentResult);
  const environmentSelections = useStore(store, s => s.environmentSelections);
  const setEnvironmentSelections = useStore(store, s => s.setEnvironmentSelections);
  return { localEnvironments, setLocalEnvironments,
    workspaceEnvironmentResult, setWorkspaceEnvironmentResult,
    environmentSelections, setEnvironmentSelections };
}
