using Microsoft.EntityFrameworkCore;
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

        await using (var db = new PakpostDbContext(options))
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

        await using var verification = new PakpostDbContext(options);
        Assert.False(await verification.Users.AnyAsync(item => item.Id == user.Id));
        Assert.False(await verification.Workspaces.AnyAsync(item => item.Id == workspace.Id));
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

        await using (var setup = new PakpostDbContext(options))
        {
            setup.Users.Add(user);
            setup.Workspaces.Add(workspace);
            setup.Collections.Add(collection);
            setup.SavedRequests.Add(request);

            await setup.SaveChangesAsync();
        }

        await using var first = new PakpostDbContext(options);
        await using var second = new PakpostDbContext(options);

        var original = await first.SavedRequests.SingleAsync(item => item.Id == request.Id);
        var stale = await second.SavedRequests.SingleAsync(item => item.Id == request.Id);

        original.Update("Changed by first editor", "GET", original.Url, "{}", "");
        await first.SaveChangesAsync();

        stale.Update("Changed by second editor", "GET", stale.Url, "{}", "");
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(async () =>
        {
            await second.SaveChangesAsync();
        });

        await using var verification = new PakpostDbContext(options);
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

        await using (var setup = new PakpostDbContext(options))
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

        await using (var db = new PakpostDbContext(options))
        {
            var repository = new WorkspaceRepository(db);
            await using var transaction = await db.BeginSerializableAsync(CancellationToken.None);

            Assert.Equal(1, await repository.DeleteOwnedAsync(
                workspace.Id,
                user.Id,
                CancellationToken.None));

            await transaction.CommitAsync(CancellationToken.None);
        }

        await using var verification = new PakpostDbContext(options);

        Assert.False(await verification.Workspaces.AnyAsync(item => item.Id == workspace.Id));
        Assert.False(await verification.Collections.AnyAsync(item => item.Id == collection.Id));
        Assert.False(await verification.CollectionFolders.AnyAsync(item => item.CollectionId == collection.Id));
        Assert.False(await verification.SavedRequests.AnyAsync(item => item.Id == request.Id));
        Assert.False(await verification.Teams.AnyAsync(item => item.WorkspaceId == workspace.Id));
        Assert.False(await verification.RequestEnvironments.AnyAsync(item => item.WorkspaceId == workspace.Id));
        Assert.False(await verification.WorkspaceMembers.AnyAsync(item => item.WorkspaceId == workspace.Id));
        Assert.True(await verification.Workspaces.AnyAsync(item => item.Id == otherWorkspace.Id));
        Assert.True(await verification.Collections.AnyAsync(item => item.Id == otherCollection.Id));
        Assert.True(await verification.Users.AnyAsync(item => item.Id == user.Id));
    }

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

        await using var db = new PakpostDbContext(options);
        await db.Database.MigrateAsync();

        return options;
    }
}
