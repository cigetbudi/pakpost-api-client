import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sortCollectionRoots} from '../src/features/collectionSort.js';

const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const env=readFileSync(new URL('../src/features/EnvironmentExplorer.jsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/v14-right-context.css',import.meta.url),'utf8');

test('global collection sort: manual order unchanged',()=>{
 const source=[{id:'b',name:'Beta'},{id:'a',name:'alpha'}];
 assert.deepEqual(sortCollectionRoots(source,'manual'),source);
 assert.notEqual(sortCollectionRoots(source,'manual'),source);
});
test('global collection sort: A–Z and Z–A without mutation',()=>{
 const source=[{name:'Zulu'},{name:'Alpha'},{name:'beta'}];
 assert.deepEqual(sortCollectionRoots(source,'name-asc').map(x=>x.name),['Alpha','beta','Zulu']);
 assert.deepEqual(sortCollectionRoots(source,'name-desc').map(x=>x.name),['Zulu','beta','Alpha']);
 assert.equal(source[0].name,'Zulu');
});
test('global collection sort: latest timestamp first',()=>{
 const source=[{name:'Older',updatedAt:'2025-01-01T00:00:00Z'},{name:'Newer',updatedAt:'2026-01-01T00:00:00Z'}];
 assert.equal(sortCollectionRoots(source,'newest')[0].name,'Newer');
});
test('v14 has app modules separated from context modules',()=>{
 assert.match(app,/aria-label="Main modules"/);
 assert.match(app,/aria-label="Context panels"/);
 assert.match(app,/pp-context-resizer/);
 assert.match(app,/pp-view-settings/);
 assert.match(styles,/grid-template-columns:78px minmax\(0,1fr\) 54px/);
});
test('environment explorer is non-modal with search and sort',()=>{
 assert.match(env,/aria-label="Search environments"/);
 assert.match(env,/ariaLabel="Sort environments"/);
 assert.doesNotMatch(env,/role="dialog"|className="overlay"/);
 assert.doesNotMatch(app,/\{envOpen &&/);
});
test('GET tab color is preserved when selected',()=>{
 assert.match(styles,/\.pp-open-tab\.current \.pp-http-label\.get/);
 assert.match(styles,/var\(--green\)!important/);
});
