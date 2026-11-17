import { useRef } from 'react';
import { environmentContextKey, environmentsForContext,
  selectionForContext, setSelectionForContext } from '../services/environmentContext.js';
import { STORAGE_WORKSPACE } from '../../import-export/services/storageScope.js';

/**
 * Resolve the currently-visible Environment without ever using the previous
 * account/workspace's Cloud data. Pending API results are still checked by
 * App before updates are accepted.
 *
 * Note that the selected ID itself is not an active Environment unless it
 * exists in the matching account/workspace result list.
 */
export function useScopedEnvironmentView({ envScope, selectedWs, userId,
  localEnvironments, workspaceEnvironmentResult, environmentSelections,
  setEnvironmentSelections, setWorkspaceEnvironmentResult }) {
  const cloudEnvironmentContext = environmentContextKey(STORAGE_WORKSPACE, selectedWs, userId);
  const environmentContext = environmentContextKey(envScope, selectedWs, userId);
  const cloudEnvironmentContextRef = useRef(cloudEnvironmentContext);
  cloudEnvironmentContextRef.current = cloudEnvironmentContext;
  const workspaceEnvironments = environmentsForContext(workspaceEnvironmentResult, cloudEnvironmentContext);
  const currentEnvironments = envScope === STORAGE_WORKSPACE ? workspaceEnvironments : localEnvironments;
  const selectedEnvironmentId = selectionForContext(environmentSelections, environmentContext);
  const activeEnvId = currentEnvironments.some(env => env.id === selectedEnvironmentId) ? selectedEnvironmentId : '';

  function selectEnvironmentForContext(scope, workspaceId, accountId, id) {
    const context = environmentContextKey(scope, workspaceId, accountId);
    if (context) setEnvironmentSelections(previous => setSelectionForContext(previous, context, id));
  }
  function setActiveEnvId(id) {
    selectEnvironmentForContext(envScope, selectedWs, userId, id);
  }
  function setWorkspaceEnvironments(updater) {
    const context = cloudEnvironmentContext;
    if (!context || context !== cloudEnvironmentContextRef.current) return;
    setWorkspaceEnvironmentResult(previous => {
      if (context !== cloudEnvironmentContextRef.current) return previous;
      const before = environmentsForContext(previous, context);
      return { context, items: typeof updater === 'function' ? updater(before) : updater };
    });
  }

  return {
    cloudEnvironmentContext, environmentContext, cloudEnvironmentContextRef,
    workspaceEnvironments, currentEnvironments, activeEnvId,
    selectEnvironmentForContext, setActiveEnvId, setWorkspaceEnvironments,
  };
}
