using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Repositories;

public sealed class CollectionRepository(PakpostDbContext db) : ICollectionRepository
{
    public async Task<Collection?> FindAsync(Guid id, CancellationToken ct)
    {
        var collection = await db.Collections.FirstOrDefaultAsync(item => item.Id == id, ct);

        if (collection is not null)
        {
            await db.DecryptCollectionAsync(collection, ct);
        }

        return collection;
    }

    public async Task<IReadOnlyList<Collection>> ListAsync(Guid workspaceId, CancellationToken ct)
    {
        var collections = await db.Collections
            .AsNoTracking()
            .Where(item => item.WorkspaceId == workspaceId)
            .OrderBy(item => item.Name)
            .ToListAsync(ct);

        foreach (var collection in collections)
        {
            await db.DecryptCollectionAsync(collection, ct);
        }

        return collections;
    }

    public async Task<IReadOnlyDictionary<Guid, int>> CountRequestsAsync(Guid workspaceId, CancellationToken ct) =>
        await db.SavedRequests
            .AsNoTracking()
            .Where(request => db.Collections.Any(collection =>
                collection.Id == request.CollectionId && collection.WorkspaceId == workspaceId))
            .GroupBy(request => request.CollectionId)
            .Select(group => new { Id = group.Key, Count = group.Count() })
            .ToDictionaryAsync(entry => entry.Id, entry => entry.Count, ct);

    public void Add(Collection collection) => db.Collections.Add(collection);

    public void Remove(Collection collection) => db.Collections.Remove(collection);
}
