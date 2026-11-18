using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Repositories;

public sealed class SavedRequestRevisionRepository(PakpostDbContext db) : ISavedRequestRevisionRepository
{
    public Task<bool> AnyAsync(Guid requestId, CancellationToken ct) =>
        db.SavedRequestRevisions.AnyAsync(revision => revision.RequestId == requestId, ct);

    public async Task<IReadOnlyList<SavedRequestRevision>> ListAsync(
        Guid requestId,
        int take,
        CancellationToken ct) =>
        await db.SavedRequestRevisions
            .AsNoTracking()
            .Where(revision => revision.RequestId == requestId)
            .OrderByDescending(revision => revision.Revision)
            .Take(Math.Clamp(take, 1, 50))
            .ToListAsync(ct);

    public Task<SavedRequestRevision?> FindAsync(Guid requestId, int revision, CancellationToken ct) =>
        db.SavedRequestRevisions
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.RequestId == requestId && item.Revision == revision, ct);

    public async Task TrimAsync(Guid requestId, int keepExisting, CancellationToken ct)
    {
        var stale = await db.SavedRequestRevisions
            .Where(revision => revision.RequestId == requestId)
            .OrderByDescending(revision => revision.Revision)
            .Skip(keepExisting)
            .ToListAsync(ct);

        db.SavedRequestRevisions.RemoveRange(stale);
    }

    public void Add(SavedRequestRevision revision) => db.SavedRequestRevisions.Add(revision);
}
