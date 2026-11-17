import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scriptDiagnostic,formatScriptDiagnostic} from '../src/features/scriptDiagnostics.js';

const code=`function randomDigit(length) {\n  for(let i=0;i<length;i++) {\n    result += Math.floor(Math.random()*10);s\n  }\n}`;

test('QuickJS stack maps a runtime fault to the original script line and column',()=>{
  const issue=scriptDiagnostic({name:'ReferenceError',message:'s is not defined',stack:
    '    at randomDigit (pakpost-script.js:107:44)\n    at <anonymous> (pakpost-script.js:110:4)'},
    {phase:'pre',code,sourceStartLine:105});
  assert.equal(issue.name,'ReferenceError');
  assert.equal(issue.message,'s is not defined');
  assert.equal(issue.line,3);
  assert.equal(issue.column,44);
  assert.match(formatScriptDiagnostic(issue),/ReferenceError: s is not defined \(line 3, column 44\)/);
});

test('worker/helper maps syntax faults and respects post-response phase',()=>{
  const issue=scriptDiagnostic({name:'SyntaxError',message:'unexpected token',stack:'at eval (pakpost-script.js:105:3)'},
    {phase:'post',code:'let = ;',sourceStartLine:105});
  assert.equal(issue.kind,'syntax');
  assert.equal(issue.phase,'post');
  assert.equal(issue.line,1);
});

test('wrapper frames must not masquerade as a user line',()=>{
  const issue=scriptDiagnostic({name:'TypeError',message:'worker failed',stack:'at eval (pakpost-script.js:21:7)'},
    {code,sourceStartLine:105});
  assert.equal(issue.line,null);
});

test('diagnostic message is size bounded and keeps unknown lines safe',()=>{
  const issue=scriptDiagnostic({name:'ReferenceError',message:'x'.repeat(10000),stack:''}, {code,sourceStartLine:105});
  assert.ok(issue.message.length<=500);
  assert.equal(issue.column,null);
});

test('the current React editor and worker are wired for diagnostics',()=>{
  const editor=readFileSync(new URL('../src/features/Editors.jsx',import.meta.url),'utf8');
  const worker=readFileSync(new URL('../src/features/sandbox.worker.js',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.match(editor,/ensureSyntaxTree/);
  assert.match(editor,/lintGutter\(\)/);
  assert.match(editor,/forceLinting/);
  assert.match(worker,/sourceStartLine=prefix\.split/);
  assert.match(worker,/vm\.evalCode\(script,'pakpost-script\.js'\)/);
  const pipeline=readFileSync(new URL('../src/features/requests/services/executeWorkbenchRequest.js',import.meta.url),'utf8');
  assert.match(pipeline,/scriptDiagnostic = post\.diagnostic/);
  assert.match(app,/setScriptDiagnostic\(scriptDiagnostic\)/);
  const scriptEditor=readFileSync(new URL('../src/features/requests/components/ScriptEditor.jsx',import.meta.url),'utf8');
  assert.match(scriptEditor,/pp-script-diagnostic-item/);
});
