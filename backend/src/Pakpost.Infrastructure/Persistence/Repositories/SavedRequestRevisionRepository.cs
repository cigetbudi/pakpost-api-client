using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Repositories;

public sealed class SavedRequestRevisionRepository(PakpostDbContext db) : ISavedRequestRevisionRepository
{
    public Task<bool> AnyAsync(Guid requestId, CancellationToken ct) =>
        db.SavedRequestRevisions.AnyAsync(revision => revision.RequestId == requestId, ct);

    public async Task<IReadOnlyList<SavedRequestRevisionOverview>> ListOverviewAsync(
        Guid requestId,
        int take,
        CancellationToken ct) => await db.SavedRequestRevisions
            .AsNoTracking()
            .Where(revision => revision.RequestId == requestId)
            .OrderByDescending(revision => revision.Revision)
            .Take(Math.Clamp(take, 1, 50))
            .Select(revision => new SavedRequestRevisionOverview(
                revision.Revision,
                revision.Action,
                revision.ActorId,
                revision.CreatedAt))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<SavedRequestRevision>> ListAsync(
        Guid requestId,
        int take,
        CancellationToken ct)
    {
        var revisions = await db.SavedRequestRevisions
            .AsNoTracking()
            .Where(revision => revision.RequestId == requestId)
            .OrderByDescending(revision => revision.Revision)
            .Take(Math.Clamp(take, 1, 50))
            .ToListAsync(ct);

        await DecryptAsync(revisions, requestId, ct);
        return revisions;
    }

    public async Task<SavedRequestRevision?> FindAsync(
        Guid requestId,
        int revision,
        CancellationToken ct)
    {
        var found = await db.SavedRequestRevisions
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.RequestId == requestId && item.Revision == revision, ct);

        if (found is not null)
        {
            await DecryptAsync([found], requestId, ct);
        }

        return found;
    }

    private async Task DecryptAsync(
        IReadOnlyList<SavedRequestRevision> revisions,
        Guid requestId,
        CancellationToken ct)
    {
        if (revisions.Count == 0)
        {
            return;
        }

        var collectionId = await db.CollectionForRequestAsync(requestId, ct);
        var workspaceId = await db.WorkspaceForCollectionAsync(collectionId, ct);

        foreach (var revision in revisions)
        {
            await db.DecryptRevisionAsync(revision, workspaceId, ct);
        }
    }

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
