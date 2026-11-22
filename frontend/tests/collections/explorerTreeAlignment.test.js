import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

const local = (read('../../src/features/collections/components/LocalCollectionsTree.jsx')+'\n'+read('../../src/features/collections/components/LocalCollectionBranch.jsx'));
const cloud = (read('../../src/features/collections/components/CloudFolderTree.jsx')+'\n'+read('../../src/features/collections/components/renderCloudFolderNodes.jsx'));
const explorer = read('../../src/features/collections/components/WorkbenchExplorer.jsx');
const styles = read('../../src/styles/layers/explorer-tree-alignment.css');
const oldStyles = read('../../src/styles/layers/cloud-folder-polish.css');

test('Local and Cloud collection and folder rows use the same tree grid', () => {
  assert.match(local, /pp-tree-row pp-explorer-tree-row/);
  assert.match(local, /pp-local-folder pp-explorer-tree-row/);
  assert.match(cloud, /pp-cloud-folder-row pp-explorer-tree-row/);
  assert.match(explorer, /pp-cloud-collection-row pp-explorer-tree-row/);
  assert.match(styles, /grid-template-columns: var\(--pp-tree-disclosure\) var\(--pp-tree-type\) minmax\(0, 1fr\) auto/);
});

test('HTTP request rows reserve the disclosure slot even without examples', () => {
  for (const source of [local, explorer]) {
    assert.match(source, /pp-explorer-tree-request/);
    assert.match(source, /pp-tree-disclosure-slot/);
    assert.match(source, /pp-tree-name/);
  }
  assert.match(styles, /grid-template-columns: var\(--pp-tree-disclosure\) var\(--pp-tree-type\) minmax\(0, 1fr\)/);
  assert.doesNotMatch(oldStyles, /pp-workspace-example-toggle \+ \.pp-cloud-request-row/);
});

test('Examples and disclosure toggles align with their actual nesting depth', () => {
  assert.match(local, /'--pp-tree-depth':depth\+2/);
  assert.match(explorer, /'--pp-tree-depth':depth\+2/);
  assert.match(cloud, /'--pp-tree-depth':depth\+1/);
  assert.match(styles, /left: calc\(var\(--pp-tree-leading\) \+ var\(--pp-tree-depth, 0\) \* var\(--pp-tree-indent\)\)/);
  assert.doesNotMatch(explorer, /paddingLeft:25\+depth\*14|paddingLeft:46/);
});


test('Explorer density keeps rows compact and badges small at every nesting level', () => {
  assert.match(styles, /--pp-tree-row-height: 28px/);
  assert.match(styles, /--pp-tree-badge-height: 18px/);
  assert.match(styles, /--pp-tree-type: 44px/);
  assert.match(styles, /--pp-tree-indent: 10px/);
  assert.doesNotMatch(styles, /--pp-tree-method: 64px|height: 36px|height: 25px/);
});

test('Folder icon and HTTP method share the same type column and text origin', () => {
  assert.match(styles, /\.pp-explorer \.pp-explorer-tree-row \{\s*grid-template-columns: var\(--pp-tree-disclosure\) var\(--pp-tree-type\) minmax\(0, 1fr\) auto/);
  assert.match(styles, /\.pp-explorer \.pp-explorer-tree-request,[\s\S]*?\.pp-explorer \.pp-explorer-tree-example \{\s*grid-template-columns: var\(--pp-tree-disclosure\) var\(--pp-tree-type\) minmax\(0, 1fr\)/);
});
