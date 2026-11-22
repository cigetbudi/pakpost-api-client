import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as portableFacade from '../../src/features/import-export/services/portableFormats.js';
import * as openApi from '../../src/features/import-export/services/openApiCollectionFormat.js';
import * as insomnia from '../../src/features/import-export/services/insomniaCollectionFormat.js';
import * as requestFacade from '../../src/features/requests/services/requestTools.js';
import * as variables from '../../src/features/requests/services/requestVariableResolution.js';
import * as realtimeFacade from '../../src/features/realtime/services/workspaceSync.js';
import * as cloudTabs from '../../src/features/realtime/services/cloudTabReconciliation.js';

const read=path=>readFileSync(new URL(`../../../${path}`,import.meta.url),'utf8');

test('portable import/export preserves public function references without script execution',()=>{
  assert.equal(portableFacade.parseOpenApiCollection,openApi.parseOpenApiCollection);
  assert.equal(portableFacade.parseInsomniaV4,insomnia.parseInsomniaV4);
  assert.equal(portableFacade.exportInsomniaV4Collection,insomnia.exportInsomniaV4Collection);
  assert.doesNotMatch(read('frontend/src/features/import-export/services/openApiCollectionFormat.js'),/\beval\(|new Function\(/);
});

test('request editor keeps stable named exports and bounded template expansion',()=>{
  assert.equal(requestFacade.resolveVars,variables.resolveVars);
  assert.equal(requestFacade.resolveRows,variables.resolveRows);
  assert.equal(requestFacade.resolveVars('{{a}}', {a:'{{b}}',b:'ok'}).value,'ok');
  assert.throws(()=>requestFacade.resolveVars('{{a}}',{a:'{{a}}'}),/Unresolved environment variable/);
});

test('realtime facade keeps independent tab hydration free from SignalR transport',()=>{
  assert.equal(realtimeFacade.reconcileRequestTabs,cloudTabs.reconcileRequestTabs);
  assert.equal(realtimeFacade.hydrateOpenCloudDetails,cloudTabs.hydrateOpenCloudDetails);
  for(const part of ['workspaceSync.js','cloudTabReconciliation.js','workspaceChangeReconciliation.js']){
    assert.doesNotMatch(read(`frontend/src/features/realtime/services/${part}`),/@microsoft\/signalr/);
  }
});

test('cloud folder domain validation and HTTP error mapping stay behind compatibility facades',()=>{
  const facade=read('backend/src/Pakpost.Application/Internal/Collections/Services/CloudFolderRules.cs');
  const domain=read('backend/src/Pakpost.Application/Internal/Collections/Services/CloudFolderHierarchyPolicy.cs');
  assert.match(facade,/WorkspacePermissions\.RequireAsync/);
  for(const method of ['ValidatePlacement','ValidateMove','ValidateTransfer','ExpandSubtrees']){
    assert.match(facade,new RegExp(`CloudFolderHierarchyPolicy\\.${method}\\(`));
    assert.match(domain,new RegExp(`public static .*${method}\\(`));
  }
  assert.match(domain,/Invalid cyclic folder hierarchy/);
  const middleware=read('backend/src/Pakpost.Api/Middlewares/GlobalExceptionMiddleware.cs');
  const mapper=read('backend/src/Pakpost.Api/Middlewares/ApiExceptionMapper.cs');
  assert.match(middleware,/context\.Response\.HasStarted/);
  assert.match(middleware,/ApiExceptionMapper\.MapException/);
  assert.match(mapper,/Internal server error/);
  assert.doesNotMatch(mapper,/new \{ message = exception\.Message \}/);
});

test('workspace management delegates member roles and confirmation to dedicated components',()=>{
  const manager=read('frontend/src/features/workspace/components/WorkspaceManager.jsx');
  const members=read('frontend/src/features/workspace/components/WorkspaceMembersSection.jsx');
  const deletion=read('frontend/src/features/workspace/components/WorkspaceDeletionDialog.jsx');
  assert.match(manager,/<WorkspaceMembersSection/);
  assert.match(manager,/<WorkspaceDeletionDialog/);
  assert.match(members,/roleSelectionChanged/);
  assert.match(members,/WorkspaceAccessBreakdown/);
  assert.match(deletion,/deleteConfirmation !== deleteTarget\.name/);
});
