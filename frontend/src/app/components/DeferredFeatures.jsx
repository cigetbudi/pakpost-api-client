import React, { lazy, Suspense } from 'react';

// Keep the common GET/Params/Headers startup path free of CodeMirror and optional tools.
// Opening Body, Scripts, a formatted response or Import/Export loads the editor
// on demand; the same instance is cached by the browser for subsequent tabs.
const DeferredCodeEditor = lazy(() => import('../../features/requests/components/Editors.jsx').then(module => ({default:module.TextEditor})));
export function TextEditor(props) {
  return <Suspense fallback={<div className="pp-editor-loading" role="status" style={{minHeight:props.minHeight==='100%'?'200px':props.minHeight||'180px'}}>Loading editor…</div>}>
    <DeferredCodeEditor {...props}/>
  </Suspense>;
}
const DeferredSettings = lazy(() => import('../../features/settings/components/WorkbenchSettings.jsx').then(module => ({default:module.WorkbenchSettings})));
export function WorkbenchSettings(props) {
  return <Suspense fallback={<div className="pp-feature-loading" role="status">Opening settings…</div>}><DeferredSettings {...props}/></Suspense>;
}
const DeferredCodeSidebar = lazy(() => import('../../features/requests/components/WorkbenchSidebars.jsx').then(module => ({default:module.CodeSidebar})));
export function CodeSidebar(props) {
  return <Suspense fallback={<div className="pp-feature-loading" role="status">Opening code generator…</div>}><DeferredCodeSidebar {...props}/></Suspense>;
}
const DeferredImportExportSidebar = lazy(() => import('../../features/requests/components/WorkbenchSidebars.jsx').then(module => ({default:module.ImportExportSidebar})));
export function ImportExportSidebar(props) {
  return <Suspense fallback={<div className="pp-feature-loading" role="status">Opening Import / Export…</div>}><DeferredImportExportSidebar {...props}/></Suspense>;
}
export const PakpostConsole = lazy(() => import('../../features/console/components/PakpostConsole.jsx'));
export const CollectionRunner = lazy(() => import('../../features/collections/components/CollectionRunner.jsx'));
export const WorkspaceManager = lazy(() => import('../../features/workspace/components/WorkspaceManager.jsx').then(m => ({default:m.WorkspaceManager})));
export const CollectionVariablesEditor = lazy(() => import('../../features/collections/components/CollectionVariablesEditor.jsx'));
export const RequestRevisionPanel = lazy(() => import('../../features/requests/components/RequestRevisionPanel.jsx'));
export const RequestBody = lazy(() => import('../../features/requests/components/RequestBody.jsx').then(m => ({default:m.RequestBody})));
export const ScriptEditor = lazy(() => import('../../features/requests/components/ScriptEditor.jsx').then(m => ({default:m.ScriptEditor})));
