import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

const application = 'backend/src/Pakpost.Application/';
const infrastructure = 'backend/src/Pakpost.Infrastructure/';

test('critical folder and request mutations commit after one SaveChanges inside a serializable transaction', () => {
  const handlers = [
    'CreateFolderHandler',
    'RenameFolderHandler',
    'MoveFolderHandler',
    'DeleteFolderItemsHandler',
    'SaveRequestHandler',
    'MoveSavedRequestHandler'
  ];

  for (const name of handlers) {
    const source = read(`${application}Internal/Collections/Handlers/${name}.cs`);
    const begin = source.indexOf('transactions.BeginSerializableAsync(');
    const save = source.indexOf('SaveChangesAsync(');
    const commit = source.indexOf('transaction.CommitAsync(');

    assert.ok(begin > 0, `${name}: transaction missing`);
    assert.ok(save > begin, `${name}: SaveChanges must run within transaction`);
    assert.ok(commit > save, `${name}: commit must follow SaveChanges`);
    assert.equal(source.match(/SaveChangesAsync\(/g)?.length, 1, name);
  }
});

test('transaction manager and scope share the request DbContext and serializable isolation', () => {
  const context = read(`${infrastructure}Persistence/PakpostDbContext.cs`);
  const registration = read(`${infrastructure}Extensions/PersistenceServiceExtensions.cs`);
  const scope = read(`${infrastructure}Persistence/EfTransactionScope.cs`);

  assert.match(context, /IUnitOfWork, ITransactionManager/);
  assert.match(context, /IsolationLevel\.Serializable/);
  assert.match(registration, /AddScoped<ITransactionManager>/);
  assert.match(registration, /GetRequiredService<PakpostDbContext>\(\)/);
  assert.match(scope, /transaction\.CommitAsync/);
  assert.match(scope, /transaction\.DisposeAsync/);
});

test('database serialization and constraint conflicts return safe HTTP 409 responses', () => {
  const middleware = read('backend/src/Pakpost.Api/Middlewares/GlobalExceptionMiddleware.cs');
  const tests = read('backend/tests/Pakpost.UnitTests/GlobalExceptionMiddlewareTests.cs');

  for (const sqlState of ['40001', '40P01', '23503', '23505']) {
    assert.ok(middleware.includes(`"${sqlState}"`));
    assert.ok(tests.includes(`"${sqlState}"`));
  }

  assert.match(middleware, /IsDatabaseConflict\(exception\)/);
  assert.match(tests, /PostgresMutationConflictsReturnSafeHttp409/);
});

test('real PostgreSQL integration tests are opt-in and database-name guarded', () => {
  const project = read('backend/tests/Pakpost.IntegrationTests/Pakpost.IntegrationTests.csproj');
  const tests = read('backend/tests/Pakpost.IntegrationTests/PostgresTransactionTests.cs');
  const script = read('backend/scripts/verify-postgres-integration.sh');

  assert.match(project, /PackageReference Include="xunit"/);
  assert.match(tests, /pakpost_integration_/);
  assert.match(tests, /PAKPOST_ALLOW_TEST_MIGRATIONS/);
  assert.match(tests, /MigrateAsync\(/);
  assert.match(tests, /DbUpdateConcurrencyException/);
  assert.match(script, /PAKPOST_TEST_POSTGRES/);
});
