import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeCloudFolderTree,folderPathForId,canMoveCloudFolder} from '../../src/features/collections/services/cloudFolderTree.js';
import {importedRequestPayload,saveCloudCollections} from '../../src/features/import-export/services/storageScope.js';
import {createLocalPostmanExport} from '../../src/features/import-export/services/importExport.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const folders=[{id:'f1',name:'Users',parentFolderId:null},{id:'f2',name:'Admin',parentFolderId:'f1'}];

test('native nested folders keep request identity separate from display name',()=>{
  const tree=makeCloudFolderTree(folders,[{id:'r1',name:'GET User',folderId:'f2'},{id:'r2',name:'Root API',folderId:null}]);
  assert.equal(tree.requests[0].name,'Root API');
  assert.equal(tree.folders[0].folders[0].requests[0].id,'r1');
  assert.deepEqual(folderPathForId(folders,'f2'),['Users','Admin']);
  assert.equal(importedRequestPayload({name:'GET User',folderPath:['Users','Admin'],url:'https://example.com'}).name,'GET User');
});
test('nested and root identities cannot be moved into cyclic parent paths',()=>{
  assert.equal(canMoveCloudFolder(folders,'f1','f2'),false);
  assert.equal(canMoveCloudFolder(folders,'f2','f1'),true);
  assert.equal(canMoveCloudFolder(folders,'f2',null),true);
  assert.throws(()=>folderPathForId([{id:'f1',name:'loop',parentFolderId:'f1'}],'f1'),/cyclic/);
});
test('backend enforces folder IDs, RBAC, recursive atomic deletion and atomic import',()=>{
  const controller=read('../../../backend/src/Pakpost.Api/Controllers/CollectionFoldersController.cs');
  const handlers = [
    '../../../backend/src/Pakpost.Application/Internal/Collections/Services/CloudFolderRules.cs',
    '../../../backend/src/Pakpost.Application/Internal/Collections/Commands/DeleteFolderItemsCommand.cs',
    '../../../backend/src/Pakpost.Application/Internal/Collections/Handlers/DeleteFolderItemsHandler.cs'
  ].map(path => read(path)).join('\n');
  const importer=read('../../../backend/src/Pakpost.Application/Internal/Collections/Handlers/ImportCollectionsHandler.cs');
  const migration=read('../../../backend/src/Pakpost.Infrastructure/Persistence/Migrations/20261117200000_NativeCloudFolders.cs');
  assert.match(controller,/HttpPatch\("\{folderId:guid\}\/move"\)/);
  assert.match(handlers,/WorkspacePermissions\.CollectionWrite/);
  assert.match(handlers,/DeleteFolderItemsCommand/);
  assert.match(handlers,/requests\.DeleteSelectedAsync\(cmd\.CollectionId/);
  assert.doesNotMatch(handlers,/requests\.ListAsync\(cmd\.CollectionId/);
  assert.match(controller,/HttpPost\("delete-items"\)/);
  assert.match(importer,/pathFolders\[currentPath\]\s*=\s*folder/);
  assert.equal((importer.match(/unitOfWork\.SaveChangesAsync\(cancellationToken\)/g)||[]).length,1);
  assert.match(migration,/AddColumn<Guid>\(name:"FolderId"/);
});

test('Postman export retains empty folders and nested Cloud request names',()=>{
  const doc=createLocalPostmanExport([{name:'Cloud APIs',folderPaths:[['Empty'],['Users','Admin']],requests:[
    {name:'Find user',requestName:'Find user',method:'GET',url:'https://api.example.com/users',folderPath:['Users','Admin']}
  ]}]);
  const col=doc.item[0];
  assert.equal(col.item.find(x=>x.name==='Empty').item.length,0);
  assert.equal(col.item.find(x=>x.name==='Users').item[0].item[0].name,'Find user');
});
test('atomic Cloud import sends folderPath without concatenating it into the request name',async()=>{
  let payload;
  await saveCloudCollections([{name:'Service',requests:[{name:'Get account',folderPath:['Banking','Accounts'],url:'https://api.example.com'}]}],{
    workspaceId:'ws',token:'secret',request:async(_,__,body)=>{payload=body;return {count:1,createdCount:1,firstId:'c1',collections:[]};}
  });
  assert.equal(payload.collections[0].requests[0].name,'Get account');
  assert.deepEqual(payload.collections[0].requests[0].folderPath,['Banking','Accounts']);
});
test('corrupt cyclic Cloud folder rows never cause infinite recursion or hide all requests',()=>{
  const tree=makeCloudFolderTree([{id:'a',name:'A',parentFolderId:'b'},{id:'b',name:'B',parentFolderId:'a'}],[{id:'r',folderId:'a'}]);
  assert.ok(tree.folders.length>0);
  assert.ok(tree.folders.some(x=>x.requests.some(r=>r.id==='r')));
});
test('local drag-drop never depends on Cloud revision; Cloud move does adopt returned revision',()=>{
  const source=read('../../src/features/collections/controllers/createCollectionActions.js');
  const local=source.slice(source.indexOf('function moveLocalRequest('),source.indexOf('async function moveWorkspaceRequest('));
  const cloud=source.slice(source.indexOf('async function moveWorkspaceRequest('),source.indexOf('function showWorkspaceMenu('));
  assert.doesNotMatch(local,/saved\.revision/);
  assert.match(cloud,/revision:saved\.revision/);
  assert.match(cloud,/targetFolderId/);
});
test('Cloud collection duplication uses atomic import with per-request native folder paths',()=>{
  const source=read('../../src/features/collections/controllers/createCollectionActions.js');
  const copy=source.slice(source.indexOf("if(action==='duplicateCollection')"),source.indexOf("if(action==='duplicateRequest')"));
  assert.match(copy,/`\$\{base\}\/import`/);
  assert.match(copy,/folderPath:folderPathForId/);
  assert.doesNotMatch(copy,/`\$\{base\}\/\$\{destination\.id\}\/requests`/);
});
