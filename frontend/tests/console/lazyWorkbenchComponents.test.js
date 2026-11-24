import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readWorkbenchSource();
const sidebars=readFileSync(new URL('../../src/features/requests/components/WorkbenchSidebars.jsx',import.meta.url),'utf8');

test('CodeMirror is loaded on demand, never imported eagerly by the app shell',()=>{
  assert.doesNotMatch(app,/^import\s+.*from\s+['"]\.\/features\/Editors['"]/m);
  assert.match(app,/lazy\(\(\) => import\('\.\.\/\.\.\/features\/requests\/components\/Editors\.jsx'\)/);
  assert.match(app,/<Suspense fallback=\{<Skeleton label="Loading editor/);
  assert.match(app,/reqTab === 'body'/); // body editing remains available
  assert.match(app,/\['pre-script','post-script'\]\.includes\(scriptTab\)/);
});

test('optional workbench panels are dynamically imported only when visible',()=>{
  assert.doesNotMatch(app,/^import\s+.*from\s+['"]\.\/features\/WorkbenchSidebars['"]/m);
  assert.doesNotMatch(app,/^import\s+.*from\s+['"]\.\/features\/WorkbenchSettings['"]/m);
  assert.match(app,/lazy\(\(\) => import\('\.\.\/\.\.\/features\/requests\/components\/WorkbenchSidebars\.jsx'\)/);
  assert.match(app,/lazy\(\(\) => import\('\.\.\/\.\.\/features\/settings\/components\/WorkbenchSettings\.jsx'\)/);
  assert.match(sidebars,/import\s+\{TextEditor\}\s+from\s+'\.\/Editors'/);
  const explorer=readFileSync(new URL('../../src/features/collections/components/WorkbenchExplorer.jsx',import.meta.url),'utf8');
  assert.match(explorer,/explorerTab === 'code' \? <CodeSidebar/);
  assert.match(explorer,/explorerTab === 'exchange'/);
});

test('exports are requested on demand and keep format selection unchanged',()=>{
  assert.doesNotMatch(app,/^import\s+.*from\s+['"]\.\/features\/exportFormats['"]/m);
  assert.match(app,/await import\('\.\.\/\.\.\/import-export\/services\/exportFormats\.js'\)/);
  assert.match(app,/downloadJson\(exportEnvironmentByFormat\(/);
  assert.match(app,/const output=exportCollectionByFormat\(/);
});

test('the Console and Collection Variables Editor remain lazy',()=>{
  assert.match(app,/lazy\(\(\) => import\('\.\.\/\.\.\/features\/console\/components\/PakpostConsole\.jsx'\)\)/);
  assert.match(app,/lazy\(\(\) => import\('\.\.\/\.\.\/features\/collections\/components\/CollectionVariablesEditor\.jsx'\)\)/);
});

// The bundle report must distinguish code editors and optional tools from
// assets referenced by index.html, not assume every generated chunk is startup.
import {collectBundleMetrics,reportBundleMetrics} from '../../scripts/performance-audit.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('bundle audit reports editor and tool chunks independently of entry assets',()=>{
  const root=mkdtempSync(join(tmpdir(),'pakpost-v815-audit-'));
  try{
    mkdirSync(join(root,'assets'));
    writeFileSync(join(root,'index.html'),'<script type="module" src="/assets/index-core.js"></script>');
    writeFileSync(join(root,'assets/index-core.js'),'console.log("boot")');
    writeFileSync(join(root,'assets/Editors-abc.js'),'console.log("lazy editor")');
    writeFileSync(join(root,'assets/WorkbenchSidebars-def.js'),'console.log("lazy tools")');
    const metrics=collectBundleMetrics(root);
    assert.ok(metrics.editorChunkGzipBytes>0);
    assert.ok(metrics.toolsChunkGzipBytes>0);
    assert.deepEqual(metrics.initialAssets,['assets/index-core.js']);
    assert.ok(metrics.initialJsGzipBytes<metrics.allJsGzipBytes);
    assert.match(reportBundleMetrics(metrics),/Editor chunk:/);
  } finally {rmSync(root,{recursive:true,force:true});}
});
