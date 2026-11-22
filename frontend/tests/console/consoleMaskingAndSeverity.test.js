import { readWorkbenchSource } from '../support/workbenchSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {
  appendConsoleEvent,clearConsoleEvents,subscribeConsoleEvents,redactConsoleMessage,
  scriptConsoleLevel,filterConsoleEvents,formatConsoleEvents,CONSOLE_EVENT_LIMIT
} from '../../src/features/console/services/pakpostConsoleStore.js';
import {collectBundleMetrics,reportBundleMetrics} from '../../scripts/performance-audit.mjs';

test('warn/error script output is classified without parsing arbitrary message bodies',()=>{
  assert.equal(scriptConsoleLevel('ERROR: failed'),'error');
  assert.equal(scriptConsoleLevel('WARN: retry'),'warn');
  assert.equal(scriptConsoleLevel('STAN: 123456'),'log');
});

test('redacts commonly named secrets and auth credentials in copied logs',()=>{
  const samples=[
    ['Bearer abc.def.xyz','abc.def.xyz'],
    ['Authorization: Bearer abc','abc'],
    ['password = "private-123"','private-123'],
    ['{"access_token":"tok-987"}','tok-987'],
    ['?client_secret=shh&foo=1','shh'],
    ['x-api-key: my-key','my-key'],
    ['Cookie: session=secret-cookie','secret-cookie']
  ];
  for(const [source,secret] of samples){
    assert.doesNotMatch(redactConsoleMessage(source),new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
});

test('filters are composable and sanitized output contains no HTTP bodies or script code',()=>{
  let latest=[];
  const stop=subscribeConsoleEvents(value=>latest=value);
  try{
    clearConsoleEvents();
    appendConsoleEvent({executionId:'one',tabId:'tab1',level:'info',phase:'network',status:200,message:'HTTP response received'});
    appendConsoleEvent({executionId:'one',tabId:'tab1',level:'error',phase:'pre-script',line:6,column:51,message:'ReferenceError: s is not defined'});
    appendConsoleEvent({executionId:'two',tabId:'tab2',level:'warn',phase:'post-script',message:'WARN: token=private'});
    const filtered=filterConsoleEvents(latest,{level:'error',phase:'pre-script',execution:'one',query:'reference'});
    assert.equal(filtered.length,1);
    assert.deepEqual([filtered[0].line,filtered[0].column],[6,51]);
    assert.equal(filterConsoleEvents(latest,{execution:'two'}).length,1);
    assert.doesNotMatch(formatConsoleEvents(latest),/private/);
    assert.match(formatConsoleEvents(filtered),/pre-script:6:51/);
    assert.ok(latest.every(row=>!('requestBody' in row)&&!('headers' in row)));
  } finally {clearConsoleEvents();stop();}
});

test('bounded ring buffer and unsubscribe avoid unbounded listeners',()=>{
  let latest=[];
  const stop=subscribeConsoleEvents(value=>latest=value);
  try{
    clearConsoleEvents();
    for(let i=0;i<CONSOLE_EVENT_LIMIT+20;i++)appendConsoleEvent({message:`event ${i}`,executionId:'e'});
    assert.equal(latest.length,CONSOLE_EVENT_LIMIT);
    assert.match(latest.at(-1).message,/519/);
    stop();
    clearConsoleEvents();
    assert.equal(latest.length,CONSOLE_EVENT_LIMIT);
  } finally {stop();clearConsoleEvents();}
});

test('Console remains lazy-loaded and App subscribes only while open',()=>{
  const app=readWorkbenchSource();
  assert.match(app,/lazy\(\(\) => import\('\.\.\/\.\.\/features\/console\/components\/PakpostConsole\.jsx'\)\)/);
  assert.match(app,/if \(!consoleOpen\) \{ setConsoleEvents\(\[\]\); return; \}/);
  assert.match(app,/\}, \[consoleOpen\]\)/);
  assert.match(app,/onNavigate=\{navigateConsoleEvent\}/);
});

test('performance audit distinguishes entry assets from lazy Console chunks',()=>{
  const dir=mkdtempSync(join(tmpdir(),'pakpost-v814-audit-'));
  try{
    mkdirSync(join(dir,'assets'));
    writeFileSync(join(dir,'index.html'),'<script type="module" src="/assets/index-ab.js"></script><link rel="stylesheet" href="/assets/index-ab.css">');
    writeFileSync(join(dir,'assets/index-ab.css'), 'body{margin:0}');
    writeFileSync(join(dir,'assets/index-ab.js'), 'console.log("boot")');
    writeFileSync(join(dir,'assets/PakpostConsole-cd.js'), 'console.log("console lazy")');
    const m=collectBundleMetrics(dir);
    assert.equal(m.jsFiles,2);
    assert.deepEqual([...m.initialAssets].sort(),['assets/index-ab.css','assets/index-ab.js']);
    assert.ok(m.initialCssGzipBytes>0);
    assert.ok(m.initialJsGzipBytes>0&&m.initialJsGzipBytes<m.allJsGzipBytes);
    assert.ok(m.consoleChunkGzipBytes>0);
    assert.match(reportBundleMetrics(m),/Initial JS/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
