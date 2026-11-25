import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
  await page.route('**/sandbox-test-host',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Sandbox test</title>'}));
  await page.goto('/sandbox-test-host');
});
async function execute(page,code){
  return page.evaluate(async code=>{
    const {runSandbox}=await import('/src/features/requests/services/runScript.js');
    try{return {output:await runSandbox(code,'pre',{env:'test'},{method:'GET',headers:{},url:{path:[]}},null,{}, {collection:'scope'})};}
    catch(error){return {error:error.message};}
  },code);
}
test('actual QuickJS can sign a request and keeps scopes separate',async({page})=>{
  const {output}=await execute(page,`const c=require('crypto-js');pm.collectionVariables.set('id','42');pm.environment.set('signature',c.HmacSHA256('hello','key').toString());pm.test('scope',()=>pm.expect(pm.collectionVariables.get('collection')).to.equal('scope'));`);
  expect(output.error).toBeNull();expect(output.tests[0].passed).toBe(true);expect(output.collectionVariables.id).toBe('42');expect(output.environmentVariables.signature).toMatch(/^[a-f0-9]{64}$/);
});
test('guest does not expose host browser or Tauri APIs',async({page})=>{
  const {output}=await execute(page,`pm.test('host globals absent',()=>{for(const name of ['fetch','XMLHttpRequest','WebSocket','Worker','document','localStorage','indexedDB','postMessage','__TAURI_INTERNALS__'])pm.expect(typeof globalThis[name]).to.equal('undefined');});pm.test('no host module',()=>{let blocked=false;try{require('node:fs')}catch{blocked=true}pm.expect(blocked).to.equal(true)});`);
  expect(output.error).toBeNull();expect(output.tests.every(t=>t.passed)).toBe(true);
});
test('CPU exhaustion ends and a fresh worker still runs',async({page})=>{
  const result=await execute(page,'while(true){}');expect(result.error||result.output?.error).toBeTruthy();
  expect((await execute(page,'pm.environment.set("ok","yes")')).output.environmentVariables.ok).toBe('yes');
});
test('reserved keys cannot cross the host boundary',async({page})=>{
  const result=await execute(page,'pm.variables.set("__proto__","test")');expect(result.error||result.output?.error).toBeTruthy();
});
test('logs are bounded',async({page})=>{
  const result=await execute(page,'console.log("x".repeat(20000));');expect(result.output.logs[0].length).toBe(8192);
  const excess=await execute(page,'for(let i=0;i<510;i++)console.log(i)');expect(excess.error||excess.output?.error).toBeTruthy();
});
test('actual QuickJS detects failing Postman assertions and supports deep equality',async({page})=>{
  const {output}=await execute(page,`pm.test('false must fail',()=>pm.expect(false).to.be.true);pm.test('deep equal',()=>pm.expect({a:1,b:[2]}).to.deep.equal({b:[2],a:1}));pm.test('missing property',()=>pm.expect({a:1}).to.have.property('b'));`);
  expect(output.error).toBeNull();expect(output.tests.map(t=>t.passed)).toEqual([false,true,false]);
});
