import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareEnvironments,filterEnvironmentCompare} from '../src/features/environmentCompare.js';

const env=(id,name,variables)=>({id,name,variables});
const variable=(key,value,extra={})=>({key,value,...extra});

const left=env('a','Token Service Net [Local Docker]',[
  variable('baseUrl','http://localhost:8080'),
  variable('client','RAYA'),
  variable('stan','100001'),
  variable('onlyDev','present'),
  variable('password','not-for-viewing'),
  variable('opaqueSecret','top-secret',{isSecret:true}),
  variable('restricted','[REDACTED]',{isSecret:true,isRedacted:true}),
]);
const right=env('b','Dev TSNET — flexible name',[
  variable('baseUrl','https://dev.example.test'),
  variable('client','RAYA'),
  variable('stan','100001'),
  variable('onlyUat','present'),
  variable('password','still-private'),
  variable('opaqueSecret','top-secret',{isSecret:true}),
  variable('restricted','[REDACTED]',{isSecret:true,isRedacted:true}),
]);

test('environment comparison matches variable keys exactly with no naming convention',()=>{
  const result=compareEnvironments(left,right);
  assert.equal(result.total,8);
  assert.equal(result.totals.matched,3); // client, stan, opaqueSecret (same but masked)
  assert.equal(result.totals.different,2); // baseUrl, password
  assert.equal(result.totals.onlyLeft,1);
  assert.equal(result.totals.onlyRight,1);
  assert.equal(result.totals.protected,1);
  assert.equal(result.rows.find(row=>row.key==='baseUrl').status,'different');
  assert.equal(result.rows.find(row=>row.key==='onlyDev').status,'onlyLeft');
  assert.equal(result.rows.find(row=>row.key==='onlyUat').status,'onlyRight');
});

test('secrets are masked in ALL comparison output including same and different values',()=>{
  const result=compareEnvironments(left,right);
  assert.equal(result.rows.find(r=>r.key==='password').status,'different');
  assert.equal(result.rows.find(r=>r.key==='opaqueSecret').status,'matched');
  const output=JSON.stringify(result);
  for(const raw of ['not-for-viewing','still-private','top-secret'])assert.ok(!output.includes(raw),`Raw secret found: ${raw}`);
  assert.equal(result.rows.find(r=>r.key==='password').left,'••••••');
});

test('restricted workspace secret cannot disclose its value or equality status',()=>{
  const result=compareEnvironments(left,right);
  const row=result.rows.find(r=>r.key==='restricted');
  assert.equal(row.status,'protected');
  assert.equal(row.left,'Restricted');
  assert.equal(row.right,'Restricted');
});

test('comparison works with missing variables, blanks and case sensitive keys',()=>{
  const result=compareEnvironments(env('a','Local',[variable('baseUrl',''),variable('Test','1')]),env('b','Some Name',[variable('baseUrl',''),variable('test','1')]));
  assert.equal(result.total,3);
  assert.equal(result.rows.find(r=>r.key==='baseUrl').status,'matched');
  assert.equal(result.rows.find(r=>r.key==='baseUrl').left,'(empty)');
  assert.equal(result.totals.onlyLeft,1);
  assert.equal(result.totals.onlyRight,1);
});

test('long values are bounded in UI and comparison does not mutate either input',()=>{
  const original=env('a','A',[variable('long','x'.repeat(4000))]);
  const other=env('b','B',[variable('long','y')]);
  const before=JSON.stringify(original);
  const result=compareEnvironments(original,other);
  assert.equal(result.rows[0].left.length,321);
  assert.equal(result.rows[0].status,'different');
  assert.equal(JSON.stringify(original),before);
});

test('search, status filter and only-changes filter compose',()=>{
  const rows=compareEnvironments(left,right).rows;
  assert.deepEqual(filterEnvironmentCompare(rows,{status:'different',query:'base'}).map(row=>row.key),['baseUrl']);
  assert.ok(filterEnvironmentCompare(rows,{onlyChanges:true}).every(row=>row.status!=='matched'));
  assert.equal(filterEnvironmentCompare(rows,{status:'protected'}).length,1);
});

test('feature is on-demand and read-only, including for QA cloud users',()=>{
  const explorer=readFileSync(new URL('../src/features/EnvironmentExplorer.jsx',import.meta.url),'utf8');
  const view=readFileSync(new URL('../src/features/EnvironmentCompare.jsx',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.match(explorer,/React\.lazy\(\(\)=>import\('\.\/EnvironmentCompare\.jsx'\)\)/);
  assert.match(explorer,/onClick=\{\(\)=>openCompare\(\)\}/);
  assert.match(explorer,/Compare with\.\.\./);
  assert.match(explorer,/disabled=\{readOnly\}/); // editing is still permission-checked
  assert.match(app,/key=\{environmentContext\|\|'cloud-pending'\}/); // remount per workspace
  assert.doesNotMatch(view,/onSave|onDelete|onCreate|api\(|localStorage|sessionStorage|\.setItem\(/);
});
