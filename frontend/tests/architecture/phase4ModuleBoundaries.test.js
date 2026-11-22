import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL(`${file.startsWith('backend/') ? '../../../' : '../../'}${file}`,import.meta.url),'utf8');

test('Workbench composes isolated hook state without moving credentials into persistent stores',()=>{
  const main=read('src/app/hooks/useWorkbenchController.jsx');
  const authorization=read('src/features/requests/hooks/useRequestAuthorizationFields.js');
  const tabs=read('src/features/requests/hooks/useRequestTabSession.js');
  const dialogs=read('src/features/collections/hooks/useCollectionDialogState.js');
  const preference=read('src/features/workspace/hooks/useWorkspaceViewPreferencePersistence.js');
  for(const name of ['useRequestAuthorizationFields','useRequestTabSession','useCollectionDialogState','useWorkspaceViewPreferencePersistence','useRequestDraftRecovery']) {
    assert.match(main,new RegExp(`${name}\\(\\{?`));
  }
  assert.match(authorization,/currentAuth/);
  assert.doesNotMatch(authorization,/localStorage|sessionStorage/);
  assert.match(tabs,/useStore\(requestWorkbenchStore, s => s\.openTabs\)/);
  assert.match(tabs,/useStore\(requestWorkbenchStore, s => s\.activeTabId\)/);
  assert.match(dialogs,/useState\(initialImportScope\)/);
  assert.match(preference,/token===BROWSER_SESSION&&me\?\.id/);
  assert.doesNotMatch(preference,/cookie|csrfToken|accessToken|sessionStorage/i);
});

test('workbench shortcuts have one mounted listener and read latest editor callbacks',()=>{
  const shortcuts=read('src/app/hooks/useWorkbenchKeyboardShortcuts.js');
  const main=read('src/app/hooks/useWorkbenchController.jsx');
  assert.match(shortcuts,/latest\.current = \{/);
  assert.match(shortcuts,/window\.addEventListener\('keydown', onKeyboard\)/);
  assert.match(shortcuts,/window\.removeEventListener\('keydown', onKeyboard\)/);
  assert.match(shortcuts,/\}, \[\]\)/);
  assert.match(shortcuts,/state\.saveCurrent\(\)/);
  assert.match(shortcuts,/!state\.loading/);
  assert.match(main,/saveCurrent: \(\) => saveCurrent\(\)/); // TDZ-safe, evaluated after render
});

test('CORS and rate limiter are registered through separate unchanged policy modules',()=>{
  const service=read('backend/src/Pakpost.Api/Extensions/WorkbenchWebServiceExtensions.cs');
  const cors=read('backend/src/Pakpost.Api/Extensions/PakpostCorsExtensions.cs');
  const limiter=read('backend/src/Pakpost.Api/Extensions/PakpostRateLimitingExtensions.cs');
  const host=read('backend/src/Pakpost.Api/Extensions/PakpostHostExtensions.cs');
  assert.match(service,/AddPakpostCors\(configuration\)/);
  assert.match(service,/AddPakpostRateLimiting\(\)/);
  assert.match(host,/AddBrowserSessionAuthentication\(configuration\)/);
  assert.match(cors,/WithOrigins\(origins\)/);
  assert.match(cors,/WithExposedHeaders\("X-Request-ID", "Retry-After"\)/);
  assert.match(limiter,/AddPolicy\("auth"/);
  assert.match(limiter,/PermitLimit = 10/);
  assert.match(limiter,/AddPolicy\("public-proxy"/);
  assert.match(limiter,/PermitLimit = 30/);
});
