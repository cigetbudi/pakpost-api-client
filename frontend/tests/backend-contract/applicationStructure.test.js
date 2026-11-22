import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../../backend/src/Pakpost.Application/', import.meta.url));
const featureRoot = path.join(root, 'Internal');
const features = ['Auth', 'Collections', 'Environments', 'Requests', 'Teams', 'Workspaces'];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    const full = path.join(directory, item.name);
    return item.isDirectory() ? walk(full) : [full];
  });
}

test('Application CQRS types have dedicated files with folder-aligned namespaces', () => {
  for (const feature of features) {
    const directory = path.join(featureRoot, feature);
    const files = walk(directory).filter(file => file.endsWith('.cs'));
    assert.ok(files.length > 0, `${feature} must have use cases`);
    assert.ok(files.some(file => file.includes('/Handlers/')), `${feature} handlers`);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const relativeFolder = path.relative(root, path.dirname(file));
      const expectedNamespace = ['Pakpost.Application', ...relativeFolder.split(path.sep)].join('.');
      assert.ok(source.includes(`namespace ${expectedNamespace};`), `namespace mismatch: ${file}`);
      const declarations = source.match(/^(?:public|internal) (?:sealed |static |abstract )*(?:class|record|interface) /gm) ?? [];
      assert.equal(declarations.length, 1, `one type per file: ${file}`);
      assert.doesNotMatch(source, /<summary>|<\/summary>/);
    }
  }
});

test('Repository contracts have dedicated files and keep same interface names', () => {
  const directory = path.join(root, 'Common/Interfaces');
  const files = readdirSync(directory).filter(name => name.endsWith('.cs'));
  assert.ok(files.length >= 16);
  assert.ok(!files.includes('IRepositories.cs'));
  for (const name of ['IUnitOfWork.cs', 'IWorkspaceRepository.cs', 'ISavedRequestRepository.cs', 'ICollectionFolderRepository.cs']) {
    assert.ok(files.includes(name));
  }
});

test('Infrastructure registrations continue resolving existing contracts', () => {
  const paths = [
    '../../../backend/src/Pakpost.Infrastructure/DependencyInjection.cs',
    '../../../backend/src/Pakpost.Infrastructure/Extensions/PersistenceServiceExtensions.cs',
    '../../../backend/src/Pakpost.Infrastructure/Extensions/ExternalServiceExtensions.cs'
  ];
  const source = paths.map(relative => readFileSync(new URL(relative, import.meta.url), 'utf8')).join('\n');
  for (const contract of ['IUnitOfWork', 'IWorkspaceRepository', 'ISavedRequestRevisionRepository', 'ICollectionFolderRepository', 'IEnvironmentValueCipher']) {
    assert.ok(source.includes(contract));
  }
});
