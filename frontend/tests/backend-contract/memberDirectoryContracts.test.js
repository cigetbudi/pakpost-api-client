import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

const application = 'backend/src/Pakpost.Application/';
const infrastructure = 'backend/src/Pakpost.Infrastructure/';

test('workspace and team member directories fetch users in one batch', () => {
  const repository = read(`${application}Common/Interfaces/IUserRepository.cs`);
  const persistence = read(`${infrastructure}Persistence/Repositories/UserRepository.cs`);

  assert.match(repository, /FindByIdsAsync\(IReadOnlyCollection<Guid> ids/);
  assert.match(persistence, /\.AsNoTracking\(\)/);
  assert.match(persistence, /userIds\.Contains\(user\.Id\)/);

  for (const handler of [
    'Workspaces/Handlers/ListWorkspaceMembersHandler.cs',
    'Teams/Handlers/ListTeamMembersHandler.cs'
  ]) {
    const source = read(`${application}Internal/${handler}`);
    assert.match(source, /users\.FindByIdsAsync\(/);
    assert.doesNotMatch(source, /users\.FindByIdAsync\(/);
    assert.match(source, /usersById\.TryGetValue\(/);
    assert.match(source, /WorkspacePermissions\.RequireMemberAsync\(/);
  }
});

test('workspace access and membership checks stay centralized', () => {
  const permissions = read(`${application}Common/Security/WorkspacePermissions.cs`);
  const roleDelegation = read(`${application}Internal/Workspaces/Services/RoleDelegation.cs`);
  const update = read(`${application}Internal/Workspaces/Handlers/UpdateWorkspaceMemberRolesHandler.cs`);

  assert.match(permissions, /public static async Task<WorkspaceMember> RequireMemberAsync\(/);
  assert.match(permissions, /public static async Task<WorkspaceMember> RequireAsync\(/);
  assert.match(roleDelegation, /CheckCanModify\(/);
  assert.match(update, /RoleDelegation\.CheckCanModify\(/);
});

test('request environment lists use no-tracking and API error contract has .NET tests', () => {
  const environment = read(`${infrastructure}Persistence/Repositories/RequestEnvironmentRepository.cs`);
  const middleware = read('backend/src/Pakpost.Api/Middlewares/GlobalExceptionMiddleware.cs');
  const tests = read('backend/tests/Pakpost.UnitTests/Api/GlobalExceptionMiddlewareTests.cs');

  assert.match(environment, /db\.RequestEnvironments\s*\.AsNoTracking\(\)\s*\.Include\(/);
  assert.match(middleware, /MapException\(/);
  assert.match(middleware, /context\.Response\.HasStarted/);
  assert.match(tests, /ValidationErrorsKeepFieldAndMessage/);
  assert.match(tests, /UnexpectedExceptionsNeverExposeInternalDetails/);
});
