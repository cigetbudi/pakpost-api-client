import { createRequestSandboxActions } from './createRequestSandboxActions.js';
import { createRequestTabManagementActions } from './createRequestTabManagementActions.js';
import { createRequestTabNavigationActions } from './createRequestTabNavigationActions.js';
import { createRequestDraftEditorActions } from './createRequestDraftEditorActions.js';
// Tabs workbench actions. Stateless factory: shared logic remains scoped to the mounted App.
// Dependencies are passed from the current render; no singleton store or persist middleware.
export function createRequestTabActions(dependencies) {

  const draftActions = createRequestDraftEditorActions(dependencies);
  const beginRequestRename = draftActions.beginRequestRename;
  const setCurrentRequestName = draftActions.setCurrentRequestName;
  const finishRequestRename = draftActions.finishRequestRename;
  const cancelRequestRename = draftActions.cancelRequestRename;
  const snapshot = draftActions.snapshot;
  const restoreDraft = draftActions.restoreDraft;
  const stashActive = draftActions.stashActive;
  const importCurlIntoCurrent = draftActions.importCurlIntoCurrent;
  const navigationActions = createRequestTabNavigationActions(Object.assign(Object.create(dependencies), { stashActive, restoreDraft }));
  const selectTab = navigationActions.selectTab;
  const navigateConsoleEvent = navigationActions.navigateConsoleEvent;
  const addTab = navigationActions.addTab;
  const selectTabFromDraft = navigationActions.selectTabFromDraft;
  const loadSavedRequest = navigationActions.loadSavedRequest;
  const managementActions = createRequestTabManagementActions(Object.assign(Object.create(dependencies), { stashActive, selectTabFromDraft }));
  const closeTab = managementActions.closeTab;
  const performTabAction = managementActions.performTabAction;
  const showTabContext = managementActions.showTabContext;
  const sandboxActions = createRequestSandboxActions(Object.assign(Object.create(dependencies), { restoreDraft }));
  const resetSandboxRequest = sandboxActions.resetSandboxRequest;

  return { beginRequestRename, setCurrentRequestName, finishRequestRename, cancelRequestRename, snapshot, restoreDraft, stashActive, selectTab, navigateConsoleEvent, addTab, importCurlIntoCurrent, closeTab, performTabAction, showTabContext, selectTabFromDraft, loadSavedRequest, resetSandboxRequest };
}
