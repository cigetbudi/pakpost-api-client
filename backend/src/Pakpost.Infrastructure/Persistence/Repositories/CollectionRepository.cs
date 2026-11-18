using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Repositories;

public sealed class CollectionRepository(PakpostDbContext db) : ICollectionRepository
{
    public Task<Collection?> FindAsync(Guid id, CancellationToken ct) =>
        db.Collections.FirstOrDefaultAsync(collection => collection.Id == id, ct);

    public async Task<IReadOnlyList<Collection>> ListAsync(Guid workspaceId, CancellationToken ct) =>
        await db.Collections
            .AsNoTracking()
            .Where(collection => collection.WorkspaceId == workspaceId)
            .OrderBy(collection => collection.Name)
            .ToListAsync(ct);

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
