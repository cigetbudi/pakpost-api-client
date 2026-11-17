import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';

const read=(file)=>readFileSync(new URL(`../../src/${file}`,import.meta.url),'utf8');

test('App is only the composition entry, not a second request controller',()=>{
  const app=read('App.jsx');
  assert.ok(app.split('\n').length<40);
  assert.match(app,/useWorkbenchController\(\)/);
  assert.match(app,/<WorkbenchView model=\{model\}/);
  assert.doesNotMatch(app,/fetch\(|api\(|sessionStorage|useState\(/);
});

test('features root has no unclassified loose JS, JSX or CSS files',()=>{
  const directory=new URL('../../src/features/',import.meta.url);
  const files=readdirSync(directory,{withFileTypes:true}).filter(x=>x.isFile());
  assert.deepEqual(files.map(x=>x.name),[]);
  for (const domain of ['auth','collections','console','environments','import-export','realtime','requests','settings','workspace']) {
    assert.equal(statSync(new URL(`../../src/features/${domain}/`,import.meta.url)).isDirectory(),true);
  }
});

test('workbench view and overlays receive only bindings explicitly exported by controller',()=>{
  const controller=read('app/hooks/useWorkbenchController.jsx');
  const view=read('app/components/WorkbenchView.jsx');
  const overlays=read('app/components/WorkbenchOverlays.jsx');
  const root=controller.match(/Explicit UI contract[\s\S]*?return \{([\s\S]*?)\n  \};/);
  assert.ok(root,'controller must expose an explicit view model');
  const exports=new Set(root[1].match(/[A-Za-z_$][\w$]*/g));
  const names=(source)=>{
    const capture=source.match(/const \{([\s\S]*?)\} = model;/);
    assert.ok(capture,'view must destructure its declared model fields');
    return capture[1].match(/[A-Za-z_$][\w$]*/g)||[];
  };
  for(const file of [view,overlays]){
    const fields=names(file);
    assert.equal(new Set(fields).size,fields.length,'UI model must have no duplicate members');
    for(const f of fields)assert.ok(exports.has(f),`missing UI field: ${f}`);
  }
  assert.match(overlays,/return <>[\s\S]*<FastTooltip\/\/?>/); // no added DOM wrapper
});

test('critical hooks are scoped to this workbench and optional feature code remains lazy',()=>{
  const runtime=read('app/hooks/useWorkbenchController.jsx');
  const optional=read('app/components/DeferredFeatures.jsx');
  const env=read('features/environments/hooks/useEnvironmentDataLifecycle.js');
  assert.match(runtime,/localEnvironments:\s*initialLocalEnvs\(\)/);
  assert.match(runtime,/useState\(\(\) => createRequestWorkbenchStore\(/);
  assert.match(runtime,/useState\(\(\) => createEnvironmentWorkbenchStore\(/);
  assert.match(runtime,/useConsoleDrawer\(\)/);
  assert.match(runtime,/useRunnerDialogState\(\)/);
  assert.match(optional,/lazy\(\(\) => import\('/);
  assert.doesNotMatch(optional,/^import .*from ['"]@uiw\/react-codemirror/m);
  assert.match(env,/cloudEnvironmentContextRef\.current===context/);
});
