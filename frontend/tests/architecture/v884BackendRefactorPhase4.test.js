import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('Save and Update Cloud requests share the same payload rules', () => {
  const base = 'backend/src/Pakpost.Application/Internal/Collections/';
  const common = read(`${base}Validators/SavedRequestPayloadValidator.cs`);
  const save = read(`${base}Validators/SaveRequestValidator.cs`);
  const update = read(`${base}Validators/UpdateSavedRequestValidator.cs`);

  assert.match(save, /SavedRequestPayloadValidator<SaveRequestCommand>/);
  assert.match(update, /SavedRequestPayloadValidator<UpdateSavedRequestCommand>/);
  assert.match(common, /ContainsNoLiteralCredentials/);
  assert.match(common, /JsonValueKind\.Object/);
  assert.match(common, /JsonValueKind\.Array/);
});

test('Cloud folder traversal is centralized and does not bypass transactional saves', () => {
  const base = 'backend/src/Pakpost.Application/Internal/Collections/';
  const rules = read(`${base}Services/CloudFolderRules.cs`);
  const move = read(`${base}Handlers/MoveFolderHandler.cs`);
  const deletion = read(`${base}Handlers/DeleteFolderItemsHandler.cs`);

  assert.match(rules, /ValidateMove\(/);
  assert.match(rules, /ExpandSubtrees\(/);
  assert.match(move, /CloudFolderRules\.ValidateMove\(/);
  assert.match(deletion, /CloudFolderRules\.ExpandSubtrees\(/);
  assert.match(move, /unitOfWork\.SaveChangesAsync/);
  assert.match(deletion, /unitOfWork\.SaveChangesAsync/);
});

test('real .NET xUnit project is included in solution with behavioral coverage', () => {
  const solution = read('backend/Pakpost.slnx');
  const project = read('backend/tests/Pakpost.UnitTests/Pakpost.UnitTests.csproj');

  assert.match(solution, /tests\/Pakpost\.UnitTests\/Pakpost\.UnitTests\.csproj/);
  assert.match(project, /PackageReference Include="xunit"/);
  assert.match(project, /PackageReference Include="NSubstitute"/);

  for (const file of [
    'SavedRequestValidationTests.cs',
    'CloudFolderRulesTests.cs',
    'CloudFolderHandlerTests.cs',
    'CloudImportHandlerTests.cs',
    'SavedRequestAccessTests.cs'
  ]) {
    const source = read(`backend/tests/Pakpost.UnitTests/${file}`);
    assert.match(source, /\[Fact\]|\[Theory\]/);
  }
});
