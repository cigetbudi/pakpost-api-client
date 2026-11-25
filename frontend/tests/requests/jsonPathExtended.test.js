import test from 'node:test';
import assert from 'node:assert/strict';
import {selectJsonPath as select,compareJsonResponses} from '../../src/features/requests/services/responseAnalysis.js';
const body=JSON.stringify({data:[{id:1,active:false,meta:{rank:3}},{id:2,active:true,meta:{rank:1}},{id:3,active:true}],nested:{id:4},"a'b":5,'a,b':6});
test('extended selectors preserve order and distinguish false from missing',()=>{
  for(const [path,expected] of [
    ['$.data[-1].id',[3]],['$.data[0,2].id',[1,3]],['$.data[::-1].id',[3,2,1]],['$.data[0:3:2].id',[1,3]],
    ['$..id',[1,2,3,4]],['$.data[?(@.active == true)].id',[2,3]],['$.data[?(@.active)].id',[1,2,3]],
    ['$.data[?(@.meta.rank >= 2)].id',[1]],['$.data[?(@["id"] != 2)].id',[1,3]],
    ["$['a\\'b','a,b']",[5,6]],['$.data[2:-4:-1].id',[3,2,1]],['$.data[?(@.missing != null)]',[]]
  ])assert.deepEqual(select(body,path),expected,path);
});
test('untrusted expressions never execute and inherited properties are not visible',()=>{
  for(const path of ['$.data[?(@.id == globalThis.alert())]','$.data[?(@.id > 0 && @.active)]','$.data[::0]','$.data[?(@.id.toString())]','$data','$.[0]'])assert.throws(()=>select(body,path),undefined,path);
  assert.deepEqual(select('{}','$..constructor'),[]);
  assert.deepEqual(select('{"constructor":42}','$..constructor'),[42]);
});
test('analysis limits apply to depth, traversal and repeated output',()=>{
  const deep='['.repeat(101)+'0'+']'.repeat(101);
  assert.throws(()=>select(deep,'$..*'),/complexity/);
  assert.throws(()=>compareJsonResponses(deep,deep),/complexity/);
  assert.throws(()=>select(JSON.stringify({x:'a'.repeat(600000)}),'$["x","x"]'),/output exceeds/);
});
