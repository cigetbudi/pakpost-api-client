import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  CLOUD_REQUEST_INITIAL_ROWS,
  CLOUD_REQUEST_PAGE_ROWS,
  filterCloudRequests,
  nextCloudRequestCount,
  visibleCloudRequestCount,
} from '../../src/features/collections/services/cloudRenderBudget.js';

const read=relative=>readFileSync(new URL(relative,import.meta.url),'utf8');

const requests=Array.from({length:3000},(_,index)=>({
  id:`r-${index}`,name:`Request ${index}`,url:`https://example.com/${index}`
}));

test('large Cloud branch starts at a bounded count and reveals in predictable pages',()=>{
  assert.equal(CLOUD_REQUEST_INITIAL_ROWS,120);
  assert.equal(CLOUD_REQUEST_PAGE_ROWS,120);
  assert.equal(visibleCloudRequestCount(requests.length,CLOUD_REQUEST_INITIAL_ROWS),120);
  assert.equal(nextCloudRequestCount(requests.length,120),240);
  assert.equal(nextCloudRequestCount(requests.length,2940),3000);
  assert.equal(nextCloudRequestCount(12,120),12);
  assert.equal(visibleCloudRequestCount(0,120),0);
  assert.equal(visibleCloudRequestCount(5,-10),0);
});

test('search is case-insensitive and sorting does not mutate original request order',()=>{
  const candidates=[{name:'Zulu',url:'/api/z'},{name:'alpha',url:'/api/a'},{name:'Bravo',url:'/api/b'}];
  assert.deepEqual(filterCloudRequests(candidates,'API/B').map(r=>r.name),['Bravo']);
  assert.deepEqual(filterCloudRequests(candidates,'',true).map(r=>r.name),['alpha','Bravo','Zulu']);
  assert.deepEqual(candidates.map(r=>r.name),['Zulu','alpha','Bravo']);
  assert.equal(filterCloudRequests(requests,'/2999').length,1);
});

test('progressive view preserves existing interaction paths and renders closed collections lazily',()=>{
  const cloud=read('../../src/features/collections/components/CloudFolderTree.jsx');
  const rows=read('../../src/features/collections/components/CloudRequestRows.jsx');
  const explorer=read('../../src/features/collections/components/WorkbenchExplorer.jsx');
  const local=read('../../src/features/collections/components/LocalCollectionsTree.jsx');
  const workbench=read('../../src/app/hooks/useWorkbenchController.jsx');
  assert.match(cloud,/open && node && renderNode\(node\)/);
  assert.match(cloud,/useMemo\(\(\) => open \? makeCloudFolderTree\(folders,requests\) : null/);
  assert.match(cloud,/<CloudRequestRows/);
  assert.match(rows,/IntersectionObserver/);
  assert.match(rows,/root: scrollRoot \|\| null/);
  assert.match(rows,/rows\.slice\(0, count\)/);
  assert.match(rows,/onClick: event => choose\(event, key\)/);
  assert.match(rows,/onContextMenu: event => onContextMenu\(event, key\)/);
  assert.match(explorer,/examplesOpen&&\(meta\.responseExamples\|\|\[\]\)\.map/);
  assert.match(workbench,/const visibleCollections = useMemo/);
  assert.match(workbench,/const commandItems = commandOpen \?/);
  assert.match(local,/opened&&tree&&<Branch/);
  assert.match(local,/opened&&<Branch/);
  assert.match(local,/examplesOpen&&examples\.map/);
});
