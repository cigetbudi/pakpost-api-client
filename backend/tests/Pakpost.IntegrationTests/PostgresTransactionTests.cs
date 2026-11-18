using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Pakpost.Infrastructure.Services;
using Npgsql;
using Pakpost.Domain.Entities;
using Pakpost.Infrastructure.Persistence;
using Pakpost.Infrastructure.Persistence.Repositories;

namespace Pakpost.IntegrationTests;

public sealed class PostgresTransactionTests
{
    [Fact]
    public async Task DisposingUncommittedTransactionRollsBackAllEntities()
    {
        var options = await CreateMigratedOptionsAsync();
        var user = new User(
            $"rollback-{Guid.NewGuid():N}@example.test",
            "Rollback test",
            "test-hash");

        var workspace = new Workspace("Rollback workspace", user.Id);
        var collection = new Collection(workspace.Id, "Rollback collection", user.Id);
        var folder = new CollectionFolder(collection.Id, null, "Rollback folder");

        await using (var db = NewContext(options))
        {
            await using (await db.BeginSerializableAsync(CancellationToken.None))
            {
                db.Users.Add(user);
                db.Workspaces.Add(workspace);
                db.Collections.Add(collection);
                db.CollectionFolders.Add(folder);

                await db.SaveChangesAsync();
            }
        }

        await using var verification = NewContext(options);
        Assert.False(await verification.Users.AnyAsync(item => item.Id == user.Id));
        Assert.False(await verification.Workspaces.AnyAsync(item => item.Id == workspace.Id));
        Assert.False(await verification.WorkspaceEncryptionKeys.AnyAsync(item => item.WorkspaceId == workspace.Id));
        Assert.False(await verification.Collections.AnyAsync(item => item.Id == collection.Id));
        Assert.False(await verification.CollectionFolders.AnyAsync(item => item.Id == folder.Id));
    }

    [Fact]
    public async Task ConcurrentEditsRejectStaleRequestRevision()
    {
        var options = await CreateMigratedOptionsAsync();
        var user = new User(
            $"concurrency-{Guid.NewGuid():N}@example.test",
            "Concurrency test",
            "test-hash");

        var workspace = new Workspace("Concurrency workspace", user.Id);
        var collection = new Collection(workspace.Id, "Concurrency collection", user.Id);
        var request = new SavedRequest(
            collection.Id,
            "List",
            "GET",
            "https://api.example.test",
            "{}",
            "");

        await using (var setup = NewContext(options))
        {
            setup.Users.Add(user);
            setup.Workspaces.Add(workspace);
            setup.Collections.Add(collection);
            setup.SavedRequests.Add(request);

            await setup.SaveChangesAsync();
        }

        await using var first = NewContext(options);
        await using var second = NewContext(options);

        var original = await new SavedRequestRepository(first).FindAsync(request.Id, CancellationToken.None)
            ?? throw new InvalidOperationException("Request not found");
        var stale = await new SavedRequestRepository(second).FindAsync(request.Id, CancellationToken.None)
            ?? throw new InvalidOperationException("Request not found");

        original.Update("Changed by first editor", "GET", original.Url, "{}", "");
        await first.SaveChangesAsync();

        stale.Update("Changed by second editor", "GET", stale.Url, "{}", "");
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(async () =>
        {
            await second.SaveChangesAsync();
        });

        await using var verification = NewContext(options);
        var current = await verification.SavedRequests.SingleAsync(item => item.Id == request.Id);

        Assert.Equal("Changed by first editor", current.Name);
        Assert.Equal(2, current.Revision);
    }

    [Fact]
    public async Task DeletingWorkspaceRemovesNestedContentWithoutTouchingOtherWorkspaces()
    {
        var options = await CreateMigratedOptionsAsync();
        var user = new User(
            $"delete-{Guid.NewGuid():N}@example.test",
            "Founder",
            "test-hash");

        var workspace = new Workspace("Workspace to delete", user.Id);
        var otherWorkspace = new Workspace("Workspace to keep", user.Id);
        var collection = new Collection(workspace.Id, "Collection to delete", user.Id);
        var otherCollection = new Collection(otherWorkspace.Id, "Collection to keep", user.Id);
        var rootFolder = new CollectionFolder(collection.Id, null, "Parent folder");
        var childFolder = new CollectionFolder(collection.Id, rootFolder.Id, "Child folder");
        var request = new SavedRequest(
            collection.Id,
            "Nested request",
            "GET",
            "https://example.test/api",
            "{}",
            "",
            folderId: childFolder.Id);

        await using (var setup = NewContext(options))
        {
            setup.Users.Add(user);
            setup.Workspaces.AddRange(workspace, otherWorkspace);
            setup.Collections.AddRange(collection, otherCollection);
            setup.CollectionFolders.Add(rootFolder);
            await setup.SaveChangesAsync();

            setup.CollectionFolders.Add(childFolder);
            await setup.SaveChangesAsync();

            setup.SavedRequests.Add(request);
            setup.Teams.Add(new Team(workspace.Id, user.Id, "Workspace team"));
            setup.RequestEnvironments.Add(new RequestEnvironment(workspace.Id, "Development"));
            setup.WorkspaceMembers.Add(new WorkspaceMember(
                workspace.Id,
                user.Id,
                Pakpost.Domain.Enums.WorkspaceRole.Owner));
            await setup.SaveChangesAsync();
        }

        await using (var db = NewContext(options))
        {
            var repository = new WorkspaceRepository(db);
            await using var transaction = await db.BeginSerializableAsync(CancellationToken.None);

            Assert.Equal(1, await repository.DeleteOwnedAsync(
                workspace.Id,
                user.Id,
                CancellationToken.None));

            await transaction.CommitAsync(CancellationToken.None);
        }

        await using var verification = NewContext(options);

        Assert.False(await verification.Workspaces.AnyAsync(item => item.Id == workspace.Id));
        Assert.False(await verification.WorkspaceEncryptionKeys.AnyAsync(item => item.WorkspaceId == workspace.Id));
        Assert.False(await verification.Collections.AnyAsync(item => item.Id == collection.Id));
        Assert.False(await verification.CollectionFolders.AnyAsync(item => item.CollectionId == collection.Id));
        Assert.False(await verification.SavedRequests.AnyAsync(item => item.Id == request.Id));
        Assert.False(await verification.Teams.AnyAsync(item => item.WorkspaceId == workspace.Id));
        Assert.False(await verification.RequestEnvironments.AnyAsync(item => item.WorkspaceId == workspace.Id));
        Assert.False(await verification.WorkspaceMembers.AnyAsync(item => item.WorkspaceId == workspace.Id));
        Assert.True(await verification.Workspaces.AnyAsync(item => item.Id == otherWorkspace.Id));
        Assert.True(await verification.WorkspaceEncryptionKeys.AnyAsync(item => item.WorkspaceId == otherWorkspace.Id));
        Assert.True(await verification.Collections.AnyAsync(item => item.Id == otherCollection.Id));
        Assert.True(await verification.Users.AnyAsync(item => item.Id == user.Id));
    }

    [Fact]
    public async Task WorkspaceContentIsEncryptedAtRestAndReadableThroughRepositories()
    {
        var options = await CreateMigratedOptionsAsync();
        var user = new User($"encrypted-{Guid.NewGuid():N}@example.test", "Encrypted", "test-hash");
        var workspace = new Workspace("Encrypted workspace", user.Id);
        var collection = new Collection(workspace.Id, "Encrypted collection", user.Id);
        collection.SetVariables("[{\"Key\":\"internal_url\",\"StoredValue\":\"private-collection-value\",\"IsSecret\":false}]");

        var request = new SavedRequest(
            collection.Id,
            "Encrypted request",
            "POST",
            "https://private.example.test/api",
            "{\"X-Correlation\":\"private-header-value\"}",
            "private-body-value",
            formFieldsJson: "[{\"key\":\"secret\"}]",
            preRequestScript: "console.log('private-script-value')",
            postResponseScript: "pm.test('private test', () => {})");

        var environment = new RequestEnvironment(workspace.Id, "Development");
        var variable = new RequestEnvironmentVariable(
            environment.Id, "API_URL", "private-environment-value", false);
        environment.Variables.Add(variable);

        var revision = new SavedRequestRevision(
            request.Id, request.Revision, user.Id, "created", "legacy-encrypted-snapshot");

        await using (var setup = NewContext(options))
        {
            setup.Users.Add(user);
            setup.Workspaces.Add(workspace);
            setup.Collections.Add(collection);
            setup.SavedRequests.Add(request);
            setup.RequestEnvironments.Add(environment);
            setup.SavedRequestRevisions.Add(revision);
            await setup.SaveChangesAsync();

            var justSaved = await new SavedRequestRepository(setup)
                .FindAsync(request.Id, CancellationToken.None);

            Assert.Equal("https://private.example.test/api", justSaved!.Url);
        }

        await using var db = NewContext(options);
        var rawRequest = await db.SavedRequests.AsNoTracking().SingleAsync(item => item.Id == request.Id);
        var rawCollection = await db.Collections.AsNoTracking().SingleAsync(item => item.Id == collection.Id);
        var rawVariable = await db.RequestEnvironmentVariables.AsNoTracking()
            .SingleAsync(item => item.Id == variable.Id);
        var rawRevision = await db.SavedRequestRevisions.AsNoTracking()
            .SingleAsync(item => item.Id == revision.Id);

        Assert.StartsWith("w1:", rawRequest.Url);
        Assert.StartsWith("\"w1:", rawRequest.HeadersJson);
        Assert.StartsWith("\"w1:", rawRequest.FormFieldsJson);
        Assert.StartsWith("w1:", rawRequest.Body);
        Assert.StartsWith("w1:", rawRequest.PreRequestScript);
        Assert.StartsWith("w1:", rawCollection.VariablesJson);
        Assert.StartsWith("w1:", rawVariable.StoredValue);
        Assert.StartsWith("w1:", rawRevision.EncryptedSnapshot);
        Assert.DoesNotContain("private", string.Join("|",
            rawRequest.Url, rawRequest.HeadersJson, rawRequest.Body,
            rawRequest.PreRequestScript, rawCollection.VariablesJson, rawVariable.StoredValue));

        Assert.NotNull(await db.WorkspaceEncryptionKeys.AsNoTracking()
            .SingleOrDefaultAsync(item => item.WorkspaceId == workspace.Id));

        var fetchedRequest = await new SavedRequestRepository(db)
            .FindAsync(request.Id, CancellationToken.None);
        var fetchedCollection = await new CollectionRepository(db)
            .FindAsync(collection.Id, CancellationToken.None);
        var fetchedEnvironment = await new RequestEnvironmentRepository(db)
            .FindAsync(environment.Id, CancellationToken.None);
        var fetchedRevision = await new SavedRequestRevisionRepository(db)
            .FindAsync(request.Id, revision.Revision, CancellationToken.None);

        Assert.Equal("https://private.example.test/api", fetchedRequest!.Url);
        Assert.Equal("private-body-value", fetchedRequest.Body);
        Assert.Contains("private-header-value", fetchedRequest.HeadersJson);
        Assert.Contains("private-collection-value", fetchedCollection!.VariablesJson);
        Assert.Equal("private-environment-value", fetchedEnvironment!.Variables.Single().StoredValue);
        Assert.Equal("legacy-encrypted-snapshot", fetchedRevision!.EncryptedSnapshot);

        Assert.Same(fetchedRequest, await new SavedRequestRepository(db)
            .FindAsync(request.Id, CancellationToken.None));

        Assert.Same(fetchedCollection, await new CollectionRepository(db)
            .FindAsync(collection.Id, CancellationToken.None));

        fetchedRequest.Update(
            fetchedRequest.Name,
            fetchedRequest.Method,
            fetchedRequest.Url,
            fetchedRequest.HeadersJson,
            "updated-private-body",
            fetchedRequest.BodyMode,
            fetchedRequest.ContentType,
            fetchedRequest.FormFieldsJson,
            fetchedRequest.PreRequestScript,
            fetchedRequest.PostResponseScript);

        await db.SaveChangesAsync();

        await using var updatedVerification = NewContext(options);
        var updatedRaw = await updatedVerification.SavedRequests.AsNoTracking()
            .SingleAsync(item => item.Id == request.Id);

        Assert.StartsWith("w1:", updatedRaw.Body);
        Assert.DoesNotContain("updated-private-body", updatedRaw.Body);

        var updatedDecrypted = await new SavedRequestRepository(updatedVerification)
            .FindAsync(request.Id, CancellationToken.None);

        Assert.Equal("updated-private-body", updatedDecrypted!.Body);
    }

    private static readonly Lazy<WorkspaceCryptography> TestCryptography = new(() =>
    {
        var key = Environment.GetEnvironmentVariable("WorkspaceEncryption__MasterKey");

        if (string.IsNullOrWhiteSpace(key))
        {
            throw new InvalidOperationException(
                "WorkspaceEncryption__MasterKey is required for integration tests");
        }

        return new WorkspaceCryptography(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["WorkspaceEncryption:MasterKey"] = key
            })
            .Build());
    });

    private static PakpostDbContext NewContext(DbContextOptions<PakpostDbContext> options) =>
        new(options, TestCryptography.Value);

    private static async Task<DbContextOptions<PakpostDbContext>> CreateMigratedOptionsAsync()
    {
        if (Environment.GetEnvironmentVariable("PAKPOST_ALLOW_TEST_MIGRATIONS") != "YES_DISPOSABLE_DB")
        {
            throw new InvalidOperationException(
                "Set PAKPOST_ALLOW_TEST_MIGRATIONS=YES_DISPOSABLE_DB before running integration tests");
        }

        var connection = Environment.GetEnvironmentVariable("PAKPOST_TEST_POSTGRES");

        if (string.IsNullOrWhiteSpace(connection))
        {
            throw new InvalidOperationException("PAKPOST_TEST_POSTGRES must point to a disposable database");
        }

        var database = new NpgsqlConnectionStringBuilder(connection).Database;

        if (string.IsNullOrWhiteSpace(database) ||
            !database.StartsWith("pakpost_integration_", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Integration tests require a database named pakpost_integration_*");
        }

        var options = new DbContextOptionsBuilder<PakpostDbContext>()
            .UseNpgsql(connection)
            .Options;

        await using var db = NewContext(options);
        await db.Database.MigrateAsync();

        return options;
    }
}
