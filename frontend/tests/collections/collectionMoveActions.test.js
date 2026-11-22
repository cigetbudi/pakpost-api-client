import test from 'node:test';
import assert from 'node:assert/strict';
import {createCollectionMoveActions} from '../../src/features/collections/controllers/createCollectionMoveActions.js';

function fixture() {
  const tabs = [
    {id: 'request', source: {scope: 'local', collectionId: 'a', requestId: 'r', folderPath: ['API', 'Users']}},
    {id: 'draft', source: {scope: 'local', collectionId: 'a', folderPath: ['API', 'Users']}},
    {id: 'unrelated', source: {scope: 'local', collectionId: 'a', folderPath: ['Other']}},
  ];
  let currentTabs = tabs;
  const actions = [];
  const move = createCollectionMoveActions({
    localCollections: [{id: 'a', requests: [{id: 'r', folderPath: ['API', 'Users']}]}],
    applyLocalAction: (collections, action) => { actions.push(action); return collections; },
    setLocalCollections: () => {},
    setOpenTabs: update => { currentTabs = update(currentTabs); },
    updateLocal: action => actions.push(action),
    setNotice: () => {},
    getMessage: e => e.message,
  });
  return {move, actions, tabs: () => currentTabs};
}

test('moving a Local endpoint updates the open tab source, preserving its draft', () => {
  const {move, actions, tabs} = fixture();
  move.moveLocalRequest({collectionId: 'a', requestId: 'r', targetCollectionId: 'b', targetFolderPath: ['API'], placement: 'into'});
  assert.equal(actions[0].type, 'moveRequest');
  assert.deepEqual(tabs()[0].source.folderPath, ['API']);
  assert.equal(tabs()[0].source.collectionId, 'b');
  assert.equal(tabs()[1].source.collectionId, 'a');
});

test('moving a Local folder preserves nested paths for open and unsaved tabs', () => {
  const {move, tabs} = fixture();
  move.moveLocalFolder({collectionId: 'a', folderPath: ['API'], targetCollectionId: 'b', targetFolderPath: ['Services']});
  assert.deepEqual(tabs()[0].source.folderPath, ['Services', 'API', 'Users']);
  assert.deepEqual(tabs()[1].source.folderPath, ['Services', 'API', 'Users']);
  assert.equal(tabs()[2].source.collectionId, 'a');
});
