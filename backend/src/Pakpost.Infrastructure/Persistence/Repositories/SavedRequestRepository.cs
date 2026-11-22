using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Repositories;

public sealed class SavedRequestRepository(PakpostDbContext db) : ISavedRequestRepository
{
    public async Task<SavedRequest?> FindAsync(Guid id, CancellationToken ct)
    {
        var request = await db.SavedRequests.FirstOrDefaultAsync(item => item.Id == id, ct);

        if (request is not null)
        {
            var workspaceId = await db.WorkspaceForCollectionAsync(request.CollectionId, ct);
            await db.DecryptRequestAsync(request, workspaceId, ct);
        }

        return request;
    }

    public Task<bool> ExistsInCollectionAsync(Guid id, Guid collectionId, CancellationToken ct) =>
        db.SavedRequests.AsNoTracking()
            .AnyAsync(item => item.Id == id && item.CollectionId == collectionId, ct);

    public async Task<SavedRequest?> FindInCollectionAsync(Guid id, Guid collectionId, CancellationToken ct)
    {
        var request = await db.SavedRequests.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id && item.CollectionId == collectionId, ct);

        if (request is not null)
        {
            var workspaceId = await db.WorkspaceForCollectionAsync(collectionId, ct);
            await db.DecryptRequestAsync(request, workspaceId, ct);
        }

        return request;
    }

    public Task<IReadOnlyList<SavedRequestIndex>> ListIndexAsync(Guid collectionId, CancellationToken ct) =>
        SavedRequestIndexReader.ListIndexAsync(db, collectionId, ct);

    public Task<SavedRequestIndexPage> PageIndexAsync(
        Guid collectionId, int size, Guid? afterId, string? afterName, string? search,
        Guid? folderId, bool rootOnly, bool sortByName, CancellationToken ct) =>
        SavedRequestIndexReader.PageIndexAsync(db, collectionId, size, afterId, afterName, search,
            folderId, rootOnly, sortByName, ct);

    public async Task<IReadOnlyList<SavedRequest>> ListAsync(Guid collectionId, CancellationToken ct)
    {
        var requests = await db.SavedRequests
            .AsNoTracking()
            .Where(request => request.CollectionId == collectionId)
            .OrderBy(request => request.SortOrder).ThenBy(request => request.Id)
            .ToListAsync(ct);

        if (requests.Count == 0)
        {
            return requests;
        }

        var workspaceId = await db.WorkspaceForCollectionAsync(collectionId, ct);

        foreach (var request in requests)
        {
            await db.DecryptRequestAsync(request, workspaceId, ct);
        }

        return requests;
    }

    public Task<int> CountExistingAsync(
        Guid collectionId,
        IReadOnlyCollection<Guid> requestIds,
        CancellationToken ct)
    {
        if (requestIds.Count == 0)
        {
            return Task.FromResult(0);
        }

        var ids = requestIds.ToArray();
        return db.SavedRequests.CountAsync(
            request => request.CollectionId == collectionId && ids.Contains(request.Id), ct);
    }

    public Task<int> DeleteSelectedAsync(
        Guid collectionId,
        IReadOnlyCollection<Guid> requestIds,
        IReadOnlyCollection<Guid> folderIds,
        CancellationToken ct)
    {
        if (requestIds.Count == 0 && folderIds.Count == 0)
        {
            return Task.FromResult(0);
        }

        var ids = requestIds.ToArray();
        var folders = folderIds.ToArray();

        return db.SavedRequests
            .Where(request => request.CollectionId == collectionId &&
                (ids.Contains(request.Id) ||
                 (request.FolderId.HasValue && folders.Contains(request.FolderId.Value))))
            .ExecuteDeleteAsync(ct);
    }

    public async Task<IReadOnlyList<MovedFolderRequestReference>> ListFolderRequestReferencesAsync(
        Guid sourceCollectionId, IReadOnlyCollection<Guid> folderIds, CancellationToken ct)
    {
        var ids=folderIds.ToArray();
        return await db.SavedRequests.AsNoTracking()
            .Where(request => request.CollectionId == sourceCollectionId &&
                request.FolderId.HasValue && ids.Contains(request.FolderId.Value))
            .Select(request => new MovedFolderRequestReference(request.Id,request.Revision))
            .ToListAsync(ct);
    }

    public Task<int> MoveFolderRequestsAsync(Guid sourceCollectionId, Guid targetCollectionId,
        IReadOnlyCollection<Guid> folderIds, CancellationToken ct)
    {
        var ids = folderIds.ToArray();
        if (ids.Length == 0) return Task.FromResult(0);
        // Updating only metadata preserves encrypted content, IDs and revision history.
        // The caller holds a serializable transaction and has checked both collection permissions.
        return db.SavedRequests.Where(request => request.CollectionId == sourceCollectionId &&
                request.FolderId.HasValue && ids.Contains(request.FolderId.Value))
            .ExecuteUpdateAsync(update => update
                .SetProperty(request => request.CollectionId, targetCollectionId)
                .SetProperty(request => request.Revision, request => request.Revision + 1)
                .SetProperty(request => request.UpdatedAt, DateTimeOffset.UtcNow), ct);
    }

    public async Task<IReadOnlyList<SavedRequest>> ListForReorderAsync(
        Guid collectionId, Guid? folderId, CancellationToken ct) =>
        await db.SavedRequests.Where(request => request.CollectionId == collectionId &&
            request.FolderId == folderId).OrderBy(request => request.SortOrder)
            .ThenBy(request => request.Id).ToListAsync(ct);

    public void Add(SavedRequest request) => db.SavedRequests.Add(request);

    public void Remove(SavedRequest request) => db.SavedRequests.Remove(request);
}
