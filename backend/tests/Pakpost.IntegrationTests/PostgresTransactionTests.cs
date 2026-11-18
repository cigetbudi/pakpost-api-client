using Microsoft.EntityFrameworkCore;
using Npgsql;
using Pakpost.Domain.Entities;
using Pakpost.Infrastructure.Persistence;

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
