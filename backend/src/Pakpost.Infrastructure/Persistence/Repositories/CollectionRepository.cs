using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
namespace Pakpost.Infrastructure.Persistence.Repositories;
public sealed class CollectionRepository(PakpostDbContext db) : ICollectionRepository
{
    public Task<Collection?> FindAsync(Guid id, CancellationToken ct)=>db.Collections.FirstOrDefaultAsync(x=>x.Id==id,ct);
    public async Task<IReadOnlyList<Collection>> ListAsync(Guid workspaceId,CancellationToken ct)
        => await db.Collections.AsNoTracking().Where(x=>x.WorkspaceId==workspaceId).OrderBy(x=>x.Name).ToListAsync(ct);
    public void Add(Collection collection)=>db.Collections.Add(collection);
}
