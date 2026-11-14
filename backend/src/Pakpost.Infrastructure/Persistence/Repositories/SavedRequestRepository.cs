using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
namespace Pakpost.Infrastructure.Persistence.Repositories;
public sealed class SavedRequestRepository(PakpostDbContext db):ISavedRequestRepository
{
    public Task<SavedRequest?> FindAsync(Guid id,CancellationToken ct)=>db.SavedRequests.FirstOrDefaultAsync(x=>x.Id==id,ct);
    public async Task<IReadOnlyList<SavedRequest>> ListAsync(Guid id,CancellationToken ct)
        =>await db.SavedRequests.AsNoTracking().Where(x=>x.CollectionId==id).OrderBy(x=>x.Name).ToListAsync(ct);
    public void Add(SavedRequest value)=>db.SavedRequests.Add(value);
    public void Remove(SavedRequest value)=>db.SavedRequests.Remove(value);
}
