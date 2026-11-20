using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Repositories;

public sealed class CollectionFolderRepository(PakpostDbContext db) : ICollectionFolderRepository
{
    public Task<CollectionFolder?> FindAsync(Guid id, CancellationToken ct) =>
        db.CollectionFolders.FirstOrDefaultAsync(folder => folder.Id == id, ct);

    public async Task<IReadOnlyList<CollectionFolder>> ListAsync(Guid collectionId, CancellationToken ct) =>
        await db.CollectionFolders
            .AsNoTracking()
            .Where(folder => folder.CollectionId == collectionId)
            .OrderBy(folder => folder.Name)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<CollectionFolder>> ListTrackedAsync(Guid collectionId, CancellationToken ct) =>
        await db.CollectionFolders.Where(folder => folder.CollectionId == collectionId).ToListAsync(ct);

    public Task<bool> HasRequestsAsync(Guid id, CancellationToken ct) =>
        db.SavedRequests.AnyAsync(request => request.FolderId == id, ct);

    public void Add(CollectionFolder folder) => db.CollectionFolders.Add(folder);

    public void Remove(CollectionFolder folder) => db.CollectionFolders.Remove(folder);
}
