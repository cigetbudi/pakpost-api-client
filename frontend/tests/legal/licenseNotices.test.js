import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
for(const [root,embedded] of [['LICENSE','LICENSE.txt'],['NOTICE','NOTICE.txt'],['ADDITIONAL_TERMS.md','ADDITIONAL_TERMS.txt']]){
  test(`About legal copy matches ${root}`,()=>{
    assert.equal(read(`../../../${root}`),read(`../../src/features/settings/legal/${embedded}`));
  });
}
test('original attribution and GPL version are present',()=>{
  const notice=read('../../../NOTICE');
  assert.match(notice,/Originally developed by cigetbudi/);
  assert.match(notice,/GPL-3.0-only/);
});
