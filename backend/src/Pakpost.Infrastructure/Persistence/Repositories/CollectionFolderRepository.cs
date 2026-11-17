using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Repositories;
public sealed class CollectionFolderRepository(PakpostDbContext db) : ICollectionFolderRepository
{
    public Task<CollectionFolder?> FindAsync(Guid id,CancellationToken ct) =>
        db.CollectionFolders.FirstOrDefaultAsync(x=>x.Id==id,ct);
    public async Task<IReadOnlyList<CollectionFolder>> ListAsync(Guid collectionId,CancellationToken ct) =>
        await db.CollectionFolders.AsNoTracking().Where(x=>x.CollectionId==collectionId)
            .OrderBy(x=>x.Name).ToListAsync(ct);
    public Task<bool> HasRequestsAsync(Guid id,CancellationToken ct) =>
        db.SavedRequests.AnyAsync(x=>x.FolderId==id,ct);
    public void Add(CollectionFolder value) => db.CollectionFolders.Add(value);
    public void Remove(CollectionFolder value) => db.CollectionFolders.Remove(value);
}
