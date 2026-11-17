// Source-based regressions intentionally inspect the composed workbench, not only App.jsx.
// Behavioral tests complement this; a moved UI must not silently drop test coverage.
import { readFileSync } from 'node:fs';

export const WORKBENCH_MODULES = Object.freeze([
  'App.jsx',
  'components/layout/AppHeader.jsx',
  'components/layout/WorkbenchNavigation.jsx',
  'components/layout/CommandPalette.jsx',
  'features/requests/components/RequestWorkbench.jsx',
  'features/requests/components/RequestDialogs.jsx',
  'features/collections/components/CollectionDialogs.jsx',
  'features/collections/controllers/collectionImportActions.js',
  'features/collections/controllers/collectionVariableActions.js',
  'features/collections/controllers/documentationActions.js',
  'features/environments/controllers/environmentActions.js',
  'features/auth/controllers/authActions.js',
  'features/requests/controllers/requestSaveActions.js',
  'features/requests/controllers/createRequestExecutionActions.js',
  'features/requests/controllers/createRequestHistoryActions.js',
  'features/requests/controllers/createRequestTabActions.js',
  'features/collections/controllers/createCollectionActions.js',
  'features/collections/controllers/createCollectionRunnerActions.js',
  'features/realtime/controllers/createRealtimeActions.js',
  'features/workspace/controllers/createInvitationActions.js',
]);

export function readWorkbenchSource() {
  return WORKBENCH_MODULES.map(path => readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8')).join('\n');
}
