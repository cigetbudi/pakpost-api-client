using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
namespace Pakpost.Infrastructure.Persistence.Repositories;
public sealed class CollectionRepository(PakpostDbContext db) : ICollectionRepository
{
    public Task<Collection?> FindAsync(Guid id, CancellationToken ct)=>db.Collections.FirstOrDefaultAsync(x=>x.Id==id,ct);
    public async Task<IReadOnlyList<Collection>> ListAsync(Guid workspaceId,CancellationToken ct)
        => await db.Collections.AsNoTracking().Where(x=>x.WorkspaceId==workspaceId).OrderBy(x=>x.Name).ToListAsync(ct);
    public async Task<IReadOnlyDictionary<Guid,int>> CountRequestsAsync(Guid workspaceId,CancellationToken ct)
        => await db.SavedRequests.AsNoTracking()
            .Where(r=>db.Collections.Any(c=>c.Id==r.CollectionId&&c.WorkspaceId==workspaceId))
            .GroupBy(r=>r.CollectionId)
            .Select(g=>new {Id=g.Key,Count=g.Count()})
            .ToDictionaryAsync(x=>x.Id,x=>x.Count,ct);
    public void Add(Collection collection)=>db.Collections.Add(collection);
    public void Remove(Collection collection)=>db.Collections.Remove(collection);
}
