using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
namespace Pakpost.Infrastructure.Persistence.Repositories;
public sealed class SavedRequestRevisionRepository(PakpostDbContext db):ISavedRequestRevisionRepository
{
    public Task<bool> AnyAsync(Guid requestId,CancellationToken ct)
        =>db.SavedRequestRevisions.AnyAsync(x=>x.RequestId==requestId,ct);
    public async Task<IReadOnlyList<SavedRequestRevision>> ListAsync(Guid requestId,int take,CancellationToken ct)
        =>await db.SavedRequestRevisions.AsNoTracking().Where(x=>x.RequestId==requestId)
            .OrderByDescending(x=>x.Revision).Take(Math.Clamp(take,1,50)).ToListAsync(ct);
    public Task<SavedRequestRevision?> FindAsync(Guid requestId,int revision,CancellationToken ct)
        =>db.SavedRequestRevisions.AsNoTracking().FirstOrDefaultAsync(x=>x.RequestId==requestId&&x.Revision==revision,ct);
    public async Task TrimAsync(Guid requestId,int keepExisting,CancellationToken ct)
    {
        var stale=await db.SavedRequestRevisions.Where(x=>x.RequestId==requestId)
            .OrderByDescending(x=>x.Revision).Skip(keepExisting).ToListAsync(ct);
        db.SavedRequestRevisions.RemoveRange(stale);
    }
    public void Add(SavedRequestRevision revision)=>db.SavedRequestRevisions.Add(revision);
}
