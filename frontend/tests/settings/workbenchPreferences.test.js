import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_WORKBENCH_PREFERENCES as defaults,normalizeWorkbenchPreferences as normalize,readWorkbenchPreferences,WORKBENCH_PREFERENCES_KEY} from '../../src/features/settings/services/workbenchPreferences.js';
test('defaults preserve adaptive layout and do not force response open',()=>assert.deepEqual(normalize(null),defaults));
test('preferences clamp invalid sizes and only retain supported settings',()=>{
  assert.deepEqual(normalize({density:'bad',editorFontSize:99,wordWrap:true,motion:false,autoExpandResponse:true,secret:'ignored'}),{density:'adaptive',editorFontSize:20,wordWrap:true,motion:false,autoExpandResponse:true});
  assert.equal(normalize({editorFontSize:1}).editorFontSize,10);
  assert.equal(normalize({editorFontSize:'13',motion:'false'}).motion,true);
});
test('loads local preferences and handles corrupted or unavailable storage',()=>{
  assert.equal(readWorkbenchPreferences({getItem:key=>{assert.equal(key,WORKBENCH_PREFERENCES_KEY);return '{"density":"comfortable"}';}}).density,'comfortable');
  assert.deepEqual(readWorkbenchPreferences({getItem:()=>'{broken'}),defaults);
  assert.deepEqual(readWorkbenchPreferences({getItem:()=>{throw Error('blocked');}}),defaults);
});
